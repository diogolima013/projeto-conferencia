// netlify/functions/buscar-pedido.js
//
// Busca um Pedido de Venda no Omie pelo número do pedido, e retorna
// uma lista simplificada de itens (código, descrição, quantidade)
// para o app comparar com o que foi bipado na conferência.
//
// Chamada esperada pelo front-end:
//   GET /.netlify/functions/buscar-pedido?numero=12345

const OMIE_URL = "https://app.omie.com.br/api/v1/produtos/pedido/";

exports.handler = async (event) => {
  const numeroPedido = event.queryStringParameters && event.queryStringParameters.numero;

  if (!numeroPedido) {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: "Informe o número do pedido (?numero=...)." }),
    };
  }

  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;

  if (!appKey || !appSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: "Credenciais da Omie não configuradas no servidor." }),
    };
  }

  try {
    // A API ListarPedidos do Omie não tem um filtro direto por número de
    // pedido — ela só retorna tudo, paginado. Então percorremos as páginas
    // até achar o pedido com o numero_pedido procurado.
    let pedido = null;
    let pagina = 1;
    const MAX_PAGINAS = 20; // limite de segurança para não rodar pra sempre

    while (!pedido && pagina <= MAX_PAGINAS) {
      const listarResp = await fetch(OMIE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call: "ListarPedidos",
          app_key: appKey,
          app_secret: appSecret,
          param: [
            {
              pagina,
              registros_por_pagina: 100,
              apenas_importado_api: "N",
            },
          ],
        }),
      });

      const listarData = await listarResp.json();

      if (listarData.faultstring) {
        return {
          statusCode: 502,
          body: JSON.stringify({ erro: "Erro na Omie: " + listarData.faultstring }),
        };
      }

      const pedidos = listarData.pedido_venda_produto || [];

      pedido = pedidos.find(
        (p) => String(p.cabecalho.numero_pedido) === String(numeroPedido)
      );

      const totalPaginas = listarData.total_de_paginas || 1;
      if (pagina >= totalPaginas) break;
      pagina++;
    }

    if (!pedido) {
      return {
        statusCode: 404,
        body: JSON.stringify({ erro: "Nenhum pedido encontrado com esse número." }),
      };
    }

    // 2) Monta a resposta simplificada com os itens do pedido.
    const itens = (pedido.det || []).map((item) => ({
      codigo: item.produto.codigo_produto,
      descricao: item.produto.descricao,
      quantidade: item.produto.quantidade,
      unidade: item.produto.unidade,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        numero_pedido: pedido.cabecalho.numero_pedido,
        cliente_codigo: pedido.cabecalho.codigo_cliente,
        itens,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: "Falha ao consultar a Omie: " + err.message }),
    };
  }
};
