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
