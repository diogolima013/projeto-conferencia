// netlify/functions/buscar-pedido.js
//
// Busca um Pedido de Venda no Omie pelo número, e retorna:
//  - itens (com EAN, pra bipar/conferir)
//  - dados do destinatário (cliente)
//  - dados da transportadora
//  - quantidade de volumes e peso total
//
// Chamada esperada pelo front-end:
//   GET /.netlify/functions/buscar-pedido?numero=12345

const OMIE_URL_PEDIDO = 'https://app.omie.com.br/api/v1/produtos/pedido/';
const OMIE_URL_PRODUTOS = 'https://app.omie.com.br/api/v1/geral/produtos/';
const OMIE_URL_CLIENTES = 'https://app.omie.com.br/api/v1/geral/clientes/';

exports.handler = async function (event) {
  const numeroPedido = (event.queryStringParameters && event.queryStringParameters.numero || '').trim();

  if (!numeroPedido) {
    return resposta(400, { erro: 'Informe o parâmetro "numero".' });
  }

  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    return resposta(500, { erro: 'OMIE_APP_KEY / OMIE_APP_SECRET não configuradas no ambiente do Netlify.' });
  }

  try {
    const pedido = await buscarPedidoPorNumero(numeroPedido, appKey, appSecret);

    if (!pedido) {
      return resposta(404, { erro: 'Nenhum pedido encontrado com esse número.' });
    }

    // --- Itens + EAN (igual antes) ---
    const detalhes = pedido.det || [];
    const eans = await Promise.all(
      detalhes.map((item) =>
        consultarEanDoProduto(item.produto.codigo_produto, appKey, appSecret)
      )
    );

    const itens = detalhes.map((item, i) => ({
      codigo_produto: item.produto.codigo_produto,
      descricao: item.produto.descricao,
      quantidade: item.produto.quantidade,
      unidade: item.produto.unidade,
      ean: eans[i] || '',
    }));

    // Peso total: soma o peso bruto de cada item (inf_adic), como fallback
    // caso o frete não traga um peso "total" já calculado.
    const pesoTotalItens = detalhes.reduce((soma, item) => {
      const peso = (item.inf_adic && item.inf_adic.peso_bruto) || 0;
      return soma + Number(peso || 0);
    }, 0);

    // --- Dados da aba "Frete e Outras Despesas" do pedido ---
    // Nomes de campo podem variar (a Omie só retorna o que foi preenchido).
    // Ajuste aqui se, ao rodar, o console.log mostrar nomes diferentes.
    const frete = pedido.frete || {};
    const quantidadeVolumes = frete.quantidade_volumes || frete.nQtdVol || 1;
    const pesoBrutoFrete = frete.peso_bruto || frete.nPesoBruto || pesoTotalItens;
    const codigoTransportadora = frete.codigo_transportadora || frete.nCodTransp || null;

    // --- Destinatário (cliente do pedido) ---
    let destinatario = null;
    if (pedido.cabecalho && pedido.cabecalho.codigo_cliente) {
      destinatario = await consultarCliente(pedido.cabecalho.codigo_cliente, appKey, appSecret);
    }

    // --- Transportadora (também é um cadastro de "cliente" na Omie) ---
    let transportadora = null;
    if (codigoTransportadora) {
      transportadora = await consultarCliente(codigoTransportadora, appKey, appSecret);
    }

    return resposta(200, {
      numero_pedido: pedido.cabecalho.numero_pedido,
      itens,
      quantidade_volumes: quantidadeVolumes,
      peso_total: pesoBrutoFrete,
      destinatario: formatarEndereco(destinatario),
      transportadora: formatarEndereco(transportadora),
      // Deixe isso comentado normalmente; descomente se precisar depurar
      // nomes de campo reais que a Omie está devolvendo nesse pedido:
      _debug_frete: frete,
    });
  } catch (err) {
    return resposta(502, { erro: 'Falha ao consultar a Omie.', detalhe: String(err) });
  }
};

async function buscarPedidoPorNumero(numeroPedido, appKey, appSecret) {
  const MAX_PAGINAS = 20;
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas && pagina <= MAX_PAGINAS) {
    const resp = await fetch(OMIE_URL_PEDIDO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ListarPedidos',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina, registros_por_pagina: 100, apenas_importado_api: 'N' }],
      }),
    });

    const data = await resp.json();
    if (data.faultstring) throw new Error(data.faultstring);

    const pedidos = data.pedido_venda_produto || [];
    const encontrado = pedidos.find(
      (p) => String(p.cabecalho.numero_pedido) === String(numeroPedido)
    );
    if (encontrado) return encontrado;

    totalPaginas = data.total_de_paginas || 1;
    pagina += 1;
  }

  return null;
}

async function consultarEanDoProduto(codigoProduto, appKey, appSecret) {
  try {
    const resp = await fetch(OMIE_URL_PRODUTOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ConsultarProduto',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ codigo_produto: codigoProduto }],
      }),
    });

    const data = await resp.json();
    if (data.faultstring) return '';
    return data.ean || '';
  } catch (e) {
    return '';
  }
}

// Consulta um cliente OU transportadora pelo código Omie
// (na Omie, transportadoras ficam no mesmo cadastro de clientes/fornecedores).
async function consultarCliente(codigoClienteOmie, appKey, appSecret) {
  try {
    const resp = await fetch(OMIE_URL_CLIENTES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ConsultarCliente',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ codigo_cliente_omie: codigoClienteOmie }],
      }),
    });

    const data = await resp.json();
    if (data.faultstring) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Padroniza o objeto de cliente/transportadora para o formato
// que o front-end espera preencher no formulário de etiqueta.
function formatarEndereco(cliente) {
  if (!cliente) return null;
  return {
    nome: cliente.razao_social || cliente.nome_fantasia || '',
    rua: [cliente.endereco, cliente.endereco_numero].filter(Boolean).join(', '),
    bairro: cliente.bairro || '',
    cidade: cliente.cidade || '',
    cep: cliente.cep || '',
    estado: cliente.estado || '',
  };
}

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
