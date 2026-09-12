// netlify/functions/buscar-pedido.js
//
// Busca um Pedido de Venda no Omie pelo número do pedido, e retorna
// uma lista de itens já com o código de barras (EAN) de cada produto,
// para o app comparar com o que foi bipado na conferência.
//
// Chamada esperada pelo front-end:
//   GET /.netlify/functions/buscar-pedido?numero=12345

const OMIE_URL_PEDIDO = 'https://app.omie.com.br/api/v1/produtos/pedido/';
const OMIE_URL_PRODUTOS = 'https://app.omie.com.br/api/v1/geral/produtos/';

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

    // O pedido traz o "codigo_produto" (código interno da Omie) de cada item,
    // mas o leitor de código de barras bipa o EAN. Então buscamos o catálogo
    // de produtos e montamos um mapa codigo_produto -> ean/descrição.
    const mapaProdutos = await buscarMapaDeProdutos(appKey, appSecret);

    const itens = (pedido.det || []).map((item) => {
      const codigoProduto = item.produto.codigo_produto;
      const produtoCompleto = mapaProdutos[codigoProduto];
      return {
        codigo_produto: codigoProduto,
        descricao: item.produto.descricao,
        quantidade: item.produto.quantidade,
        unidade: item.produto.unidade,
        ean: (produtoCompleto && produtoCompleto.ean) || '',
      };
    });

    return resposta(200, {
      numero_pedido: pedido.cabecalho.numero_pedido,
      cliente_codigo: pedido.cabecalho.codigo_cliente,
      itens,
    });
  } catch (err) {
    return resposta(502, { erro: 'Falha ao consultar a Omie.', detalhe: String(err) });
  }
};

// Percorre as páginas de ListarPedidos até achar o pedido com esse número
// (a API da Omie não tem um filtro direto por número de pedido).
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

// Busca todo o catálogo de produtos e monta um mapa por codigo_produto,
// para descobrir o EAN de cada item do pedido.
async function buscarMapaDeProdutos(appKey, appSecret) {
  const mapa = {};
  const MAX_PAGINAS = 20;
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas && pagina <= MAX_PAGINAS) {
    const resp = await fetch(OMIE_URL_PRODUTOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ListarProdutosResumido',
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina, registros_por_pagina: 200, apenas_importado_api: 'N' }],
      }),
    });

    const data = await resp.json();
    if (data.faultstring) throw new Error(data.faultstring);

    const lista = data.produto_servico_resumido || data.produtos || [];
    lista.forEach((p) => {
      mapa[p.codigo_produto] = p;
    });

    totalPaginas = data.total_de_paginas || 1;
    pagina += 1;
  }

  return mapa;
}

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}