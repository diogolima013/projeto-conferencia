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
    // mas o leitor de código de barras bipa o EAN. Então consultamos, em
    // paralelo, só os produtos que aparecem nesse pedido (bem mais rápido
    // do que baixar o catálogo inteiro).
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

// Consulta um único produto pelo codigo_produto e retorna o EAN dele.
// Se der qualquer erro, retorna string vazia em vez de travar tudo
// (o item continua aparecendo no app, só sem código de barras).
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

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}