// Ponto de entrada: liga os listeners dos campos de cabeçalho e do leitor físico
// de código de barras, e faz a primeira renderização da tela.

document.getElementById('orderRef').addEventListener('input', render);
document.getElementById('notaFiscal').addEventListener('input', render);

let scanTimer = null;

document.getElementById('scanInput').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    clearTimeout(scanTimer);
    processScan(this.value);
  }
});

// Fallback para leitores que não enviam Enter: dispara ao parar de digitar rápido
document.getElementById('scanInput').addEventListener('input', function(){
  clearTimeout(scanTimer);
  const val = this.value;
  scanTimer = setTimeout(() => {
    if(val.length >= 4){ processScan(val); }
  }, 80);
});

render();

document.getElementById('itemBarcode').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    preencherViaOmie(this.value.trim());
    document.getElementById('itemQty').focus();
  }
});
