// netlify/functions/consultar-produto.js
//
// Recebe um código de barras (EAN) do app e consulta o produto correspondente
// na Omie, SEM expor App Key / App Secret no navegador.
//
// Chamado pelo frontend assim:
//   GET /.netlify/functions/consultar-produto?ean=7890010210116
//
// Variáveis de ambiente necessárias (configurar no painel do Netlify,
// em Site settings > Environment variables — NUNCA no código):
//   OMIE_APP_KEY
//   OMIE_APP_SECRET

const OMIE_URL = 'https://app.omie.com.br/api/v1/geral/produtos/';

exports.handler = async function (event) {
  const ean = (event.queryStringParameters && event.queryStringParameters.ean || '').trim();

  if (!ean) {
    return resposta(400, { erro: 'Informe o parâmetro "ean".' });
  }

  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    return resposta(500, { erro: 'OMIE_APP_KEY / OMIE_APP_SECRET não configuradas no ambiente do Netlify.' });
  }

  try {
    // A Omie não documenta um filtro direto "por EAN" no ListarProdutosResumido,
    // então paginamos a listagem e filtramos pelo campo "ean" de cada produto.
    // Para catálogos grandes, isso pode precisar de ajuste (ex: cache local,
    // ou usar o campo "codigo" se vocês padronizarem código = EAN na Omie).
    const produto = await buscarProdutoPorEan(ean, appKey, appSecret);

    if (!produto) {
      return resposta(404, { erro: 'Produto não encontrado na Omie para este código de barras.' });
    }

    return resposta(200, {
      codigo_produto: produto.codigo_produto,
      codigo: produto.codigo,
      descricao: produto.descricao,
      ean: produto.ean
    });

  } catch (err) {
    return resposta(502, { erro: 'Falha ao consultar a Omie.', detalhe: String(err) });
  }
};

async function buscarProdutoPorEan(ean, appKey, appSecret) {
  const tamanhoPagina = 200;
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas) {
    const body = {
      call: 'ListarProdutosResumido',
      app_key: appKey,
      app_secret: appSecret,
      param: [{
        pagina: pagina,
        registros_por_pagina: tamanhoPagina,
        apenas_importado_api: 'N'
      }]
    };

    const resp = await fetch(OMIE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      throw new Error('Omie respondeu HTTP ' + resp.status);
    }

    const data = await resp.json();

    if (data.faultstring) {
      throw new Error(data.faultstring);
    }

    const lista = data.produto_servico_resumido || data.produtos || [];
    const encontrado = lista.find(p => (p.ean || '').trim() === ean);
    if (encontrado) return encontrado;

    totalPaginas = data.total_de_paginas || 1;
    pagina += 1;
  }

  return null;
}

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
