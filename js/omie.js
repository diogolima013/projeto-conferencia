// Fala com a Netlify Function (não com a Omie direto — as chaves ficam só no servidor).

async function consultarProdutoNaOmie(ean){
  try{
    const resp = await fetch('/.netlify/functions/consultar-produto?ean=' + encodeURIComponent(ean));
    if(!resp.ok) return null;
    return await resp.json();
  } catch(e){
    // Sem conexão com a function (ex: rodando local sem `netlify dev`) — segue sem preencher.
    return null;
  }
}

// Tenta preencher o nome do item automaticamente a partir do cadastro na Omie.
// Não trava o fluxo se falhar — o usuário sempre pode digitar o nome na mão.
async function preencherViaOmie(ean){
  const produto = await consultarProdutoNaOmie(ean);
  if(produto && produto.descricao){
    const nomeInput = document.getElementById('itemName');
    if(!nomeInput.value.trim()){
      nomeInput.value = produto.descricao;
    }
  }
}

// Busca o pedido inteiro na Omie (número + itens esperados), pra conferência.
async function buscarPedidoNaOmie(numeroPedido){
  try{
    const resp = await fetch('/.netlify/functions/buscar-pedido?numero=' + encodeURIComponent(numeroPedido));
    const data = await resp.json();
    if(!resp.ok){
      return { erro: data.erro || 'Erro ao buscar pedido na Omie.' };
    }
    return data;
  } catch(e){
    return { erro: 'Sem conexão com o servidor.' };
  }
}