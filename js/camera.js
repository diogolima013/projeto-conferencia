// Leitura de código de barras via câmera (BarcodeDetector do navegador).
// Dois fluxos independentes: cadastro de item (preenche o campo e para) e
// bipagem contínua (conta os itens enquanto a câmera fica aberta).

// --- Câmera para preencher o código de barras no cadastro do item ---

let addItemCameraStream = null;
let addItemDetectLoop = null;

async function scanBarcodeForNewItem(){
  const cameraArea = document.getElementById('addItemCameraArea');
  const video = document.getElementById('addItemCameraVideo');

  if(location.protocol !== 'https:' && location.hostname !== 'localhost'){
    alert('Câmera bloqueada: abra este link em um endereço https:// (arquivo local não permite acesso à câmera).');
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    alert('Este navegador não permite acesso à câmera aqui.');
    return;
  }
  if(!('BarcodeDetector' in window)){
    alert('Este navegador não suporta leitura de código de barras por câmera. Use um leitor físico ou o Chrome no Android.');
    return;
  }

  try{
    addItemCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = addItemCameraStream;
    await video.play();
    cameraArea.style.display = 'block';

    const detector = new BarcodeDetector({
      formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','codabar','itf','qr_code']
    });

    async function detectFrame(){
      if(!addItemCameraStream) return;
      try{
        const codes = await detector.detect(video);
        if(codes.length > 0){
          document.getElementById('itemBarcode').value = codes[0].rawValue;
          stopAddItemCameraScan();
          if(navigator.vibrate) navigator.vibrate(40);
          preencherViaOmie(codes[0].rawValue);
          document.getElementById('itemName').focus();
          return;
        }
      } catch(e){ /* frame sem leitura, segue tentando */ }
      addItemDetectLoop = requestAnimationFrame(detectFrame);
    }
    detectFrame();

  } catch(e){
    alert('Não foi possível acessar a câmera (permissão negada ou indisponível).');
  }
}

function stopAddItemCameraScan(){
  if(addItemDetectLoop) cancelAnimationFrame(addItemDetectLoop);
  addItemDetectLoop = null;
  if(addItemCameraStream){
    addItemCameraStream.getTracks().forEach(track => track.stop());
    addItemCameraStream = null;
  }
  document.getElementById('addItemCameraArea').style.display = 'none';
}

// --- Câmera para bipagem contínua (contagem de itens) ---

let cameraStream = null;
let cameraDetectLoop = null;

async function startCameraScan(){
  const cameraArea = document.getElementById('cameraArea');
  const video = document.getElementById('cameraVideo');

  if(location.protocol !== 'https:' && location.hostname !== 'localhost'){
    showScanFeedback('⚠ Câmera bloqueada: abra este arquivo em um endereço https:// (arquivo local não permite acesso à câmera).', 'error');
    return;
  }

  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showScanFeedback('⚠ Este navegador não permite acesso à câmera aqui.', 'error');
    return;
  }

  if(!('BarcodeDetector' in window)){
    showScanFeedback('⚠ Este navegador não suporta leitura de código de barras por câmera. Use um leitor físico ou o Chrome no Android.', 'error');
    return;
  }

  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = cameraStream;
    await video.play();
    cameraArea.style.display = 'block';
    document.getElementById('cameraScanBtn').style.display = 'none';

    const detector = new BarcodeDetector({
      formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','codabar','itf','qr_code']
    });

    let lastCode = null, lastTime = 0;

    async function detectFrame(){
      if(!cameraStream) return;
      try{
        const codes = await detector.detect(video);
        if(codes.length > 0){
          const code = codes[0].rawValue;
          const now = Date.now();
          if(code !== lastCode || now - lastTime > 1500){
            lastCode = code;
            lastTime = now;
            processScan(code);
          }
        }
      } catch(e){ /* frame sem leitura, segue tentando */ }
      cameraDetectLoop = requestAnimationFrame(detectFrame);
    }
    detectFrame();

  } catch(e){
    showScanFeedback('⚠ Não foi possível acessar a câmera (permissão negada ou indisponível).', 'error');
  }
}

function stopCameraScan(){
  if(cameraDetectLoop) cancelAnimationFrame(cameraDetectLoop);
  cameraDetectLoop = null;
  if(cameraStream){
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  document.getElementById('cameraArea').style.display = 'none';
  document.getElementById('cameraScanBtn').style.display = 'block';
}
