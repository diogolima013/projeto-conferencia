// Estado da conferência: lista de itens do pedido e funções básicas de manipulação.

let items = [];

function addItem(){
  const name = document.getElementById('itemName').value.trim();
  const qty = parseInt(document.getElementById('itemQty').value) || 1;
  const barcode = document.getElementById('itemBarcode').value.trim();
  if(!name){ alert('Digite o nome do produto.'); return; }
  stopAddItemCameraScan();
  items.push({ name, expected: qty, counted: 0, barcode });
  document.getElementById('itemName').value = '';
  document.getElementById('itemQty').value = 1;
  document.getElementById('itemBarcode').value = '';
  document.getElementById('itemName').focus();
  render();
}

function changeCount(idx, delta){
  const it = items[idx];
  it.counted = Math.max(0, Math.min(it.expected, it.counted + delta));
  render();
}

function removeItem(idx){
  items.splice(idx, 1);
  render();
}

function resetAll(){
  if(items.length && !confirm('Limpar todos os itens e começar um novo pedido?')) return;
  items = [];
  document.getElementById('orderRef').value = '';
  document.getElementById('notaFiscal').value = '';
  document.getElementById('scanInput').value = '';
  document.getElementById('scanFeedback').textContent = '';
  limparFormularioEnvio();
  render();
}

function render(){
  const ref = document.getElementById('orderRef').value.trim();
  const nf = document.getElementById('notaFiscal').value.trim();
  const orderLabel = document.getElementById('orderLabel');
  if(ref || nf){
    orderLabel.style.display = 'block';
    orderLabel.innerHTML = 'Conferindo: <b>' + (ref || '(sem número)') + '</b>' + (nf ? ' &nbsp;|&nbsp; NF: <b>' + escapeHtml(nf) + '</b>' : '');
  } else {
    orderLabel.style.display = 'none';
  }

  const list = document.getElementById('itemsList');
  const emptyMsg = document.getElementById('emptyMsg');
  const scanCard = document.getElementById('scanCard');
  list.innerHTML = '';

  if(items.length === 0){
    emptyMsg.style.display = 'block';
    scanCard.style.display = 'none';
  } else {
    emptyMsg.style.display = 'none';
    if(scanCard.style.display !== 'block'){
      scanCard.style.display = 'block';
      setTimeout(() => document.getElementById('scanInput').focus(), 50);
    }
  }

  let allComplete = items.length > 0;
  let totalExpected = 0, totalCounted = 0;

  items.forEach((it, idx) => {
    totalExpected += it.expected;
    totalCounted += it.counted;
    const isOk = it.counted >= it.expected;
    if(!isOk) allComplete = false;

    const div = document.createElement('div');
    div.className = 'item' + (isOk ? ' ok' : '');
    div.innerHTML = `
      <div class="check">${isOk ? '✓' : ''}</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(it.name)}</div>
        <div class="item-qty">Esperado: ${it.expected}${it.barcode ? ' · Cód: ' + escapeHtml(it.barcode) : ''}</div>
      </div>
      <div class="counter">
        <button onclick="changeCount(${idx}, -1)">−</button>
        <div class="count">${it.counted}</div>
        <button onclick="changeCount(${idx}, 1)">+</button>
      </div>
      <button class="remove-btn" onclick="removeItem(${idx})">remover</button>
    `;
    list.appendChild(div);
  });

  const statusText = document.getElementById('statusText');
  if(items.length === 0){
    statusText.textContent = 'Adicione os itens do pedido';
    statusText.className = 'status-text';
  } else if(allComplete){
    statusText.textContent = '✓ Pedido completo — liberado para fechar (' + totalCounted + '/' + totalExpected + ' itens)';
    statusText.className = 'status-text status-complete';
  } else {
    statusText.textContent = '⚠ Faltam itens — ' + totalCounted + '/' + totalExpected + ' conferidos';
    statusText.className = 'status-text status-incomplete';
  }

  toggleShippingCard(allComplete);
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Carrega os itens esperados de um pedido direto da Omie, substituindo
// a lista atual (com confirmação, se já houver itens na tela). Também
// já deixa o formulário de etiqueta pré-preenchido com destinatário,
// transportadora, volumes e peso vindos do pedido.
async function carregarPedidoDaOmie(numeroPedido){
  if(!numeroPedido) return;

  if(items.length && !confirm('Isso vai substituir os itens atuais pelos do pedido ' + numeroPedido + ' na Omie. Continuar?')){
    return;
  }

  showScanFeedback('Buscando pedido ' + numeroPedido + ' na Omie...', 'ok');

  const resultado = await buscarPedidoNaOmie(numeroPedido);

  if(resultado.erro){
    showScanFeedback('⚠ ' + resultado.erro, 'error');
    return;
  }

  items = resultado.itens.map(function(item){
    return {
      name: item.descricao,
      expected: item.quantidade,
      counted: 0,
      barcode: item.ean || ''
    };
  });

  // Pré-preenche o card de etiqueta com o que veio da Omie.
  // O usuário ainda pode ajustar/completar antes de gerar as etiquetas.
  preencherFormularioEnvio(resultado);

  showScanFeedback('✓ Pedido ' + numeroPedido + ' carregado (' + items.length + ' itens)', 'ok');
  render();
}
