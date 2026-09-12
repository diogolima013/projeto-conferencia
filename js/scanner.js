// Bipagem de produtos: casa o código lido (por leitor físico ou câmera) com um item da lista.

function processScan(code){
  code = code.trim();
  if(!code) return;

  const matches = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.barcode && it.barcode === code);

  if(matches.length === 0){
    showScanFeedback('⚠ Código não encontrado: ' + code, 'error');
    return;
  }

  // Prioriza um item que ainda não está completo
  const pending = matches.find(({ it }) => it.counted < it.expected);
  const target = pending || matches[0];

  if(target.it.counted >= target.it.expected){
    showScanFeedback('✓ "' + target.it.name + '" já está completo', 'ok');
    return;
  }

  target.it.counted += 1;
  showScanFeedback('✓ +1 "' + target.it.name + '" (' + target.it.counted + '/' + target.it.expected + ')', 'ok');
  render();
  focusScanInput();
}

function focusScanInput(){
  const scanInput = document.getElementById('scanInput');
  if(scanInput && scanInput.offsetParent !== null){
    scanInput.value = '';
    scanInput.focus();
  }
}
