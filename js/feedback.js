// Feedback sensorial de bipagem: som (Web Audio) e vibração.

let audioCtx = null;

function playBeep(type){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    if(type === 'ok'){
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } else {
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch(e){ /* Web Audio indisponível — ignora silenciosamente */ }
}

function vibrateFeedback(type){
  if(navigator.vibrate){
    navigator.vibrate(type === 'ok' ? 40 : [60, 60, 60]);
  }
}

function showScanFeedback(msg, type){
  const fb = document.getElementById('scanFeedback');
  fb.textContent = msg;
  fb.style.color = type === 'ok' ? 'var(--accent)' : (type === 'error' ? 'var(--danger)' : 'var(--muted)');
  if(type === 'ok' || type === 'error'){
    playBeep(type);
    vibrateFeedback(type);
  }
}
