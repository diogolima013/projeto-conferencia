// Geração das etiquetas de expedição (formato térmico 10x15cm) e impressão.

function fillLabelForm(){
  // placeholder hook if future auto-fill logic is needed
}

function toggleShippingCard(show){
  document.getElementById('shippingCard').style.display = show ? 'block' : 'none';
}

// Preenche o card "dados para etiqueta" com o que veio da Omie
// (destinatário, transportadora, volumes, peso). Só preenche um campo
// se ele ainda estiver vazio, pra não sobrescrever algo que o usuário
// já tenha digitado/ajustado na tela.
function preencherFormularioEnvio(resultado){
  if(!resultado) return;

  preencherSeVazio('qtyVolumes', resultado.quantidade_volumes);
  preencherSeVazio('totalWeight', resultado.peso_total);

  if(resultado.destinatario){
    preencherSeVazio('destNome', resultado.destinatario.nome);
    preencherSeVazio('destRua', resultado.destinatario.rua);
    preencherSeVazio('destBairro', resultado.destinatario.bairro);
    preencherSeVazio('destCidade', resultado.destinatario.cidade);
    preencherSeVazio('destCep', resultado.destinatario.cep);
    preencherSeVazio('destEstado', resultado.destinatario.estado);
  }

  if(resultado.transportadora){
    preencherSeVazio('transpNome', resultado.transportadora.nome);
    preencherSeVazio('transpRua', resultado.transportadora.rua);
    preencherSeVazio('transpBairro', resultado.transportadora.bairro);
    preencherSeVazio('transpCidade', resultado.transportadora.cidade);
    preencherSeVazio('transpCep', resultado.transportadora.cep);
    preencherSeVazio('transpEstado', resultado.transportadora.estado);
  }
}

function preencherSeVazio(id, valor){
  if(valor === undefined || valor === null || valor === '') return;
  const el = document.getElementById(id);
  if(el && !el.value.trim()){
    el.value = valor;
  }
}

function limparFormularioEnvio(){
  ['qtyVolumes', 'totalWeight', 'destNome', 'destRua', 'destBairro', 'destCidade',
   'destCep', 'destEstado', 'transpNome', 'transpRua', 'transpBairro',
   'transpCidade', 'transpCep', 'transpEstado'].forEach(function(id){
    const el = document.getElementById(id);
    if(el) el.value = (id === 'qtyVolumes') ? 1 : '';
  });
  document.getElementById('labelPreviewArea').innerHTML = '';
  document.getElementById('printArea').innerHTML = '';
}

function generateLabels(){
  const orderRef = document.getElementById('orderRef').value.trim() || '(sem número)';
  const notaFiscal = document.getElementById('notaFiscal').value.trim();
  const qty = parseInt(document.getElementById('qtyVolumes').value) || 1;
  const weight = document.getElementById('totalWeight').value.trim();

  const destNome = document.getElementById('destNome').value.trim();
  const destRua = document.getElementById('destRua').value.trim();
  const destBairro = document.getElementById('destBairro').value.trim();
  const destCidade = document.getElementById('destCidade').value.trim();
  const destCep = document.getElementById('destCep').value.trim();
  const destEstado = document.getElementById('destEstado').value.trim();

  const transpNome = document.getElementById('transpNome').value.trim();
  const transpRua = document.getElementById('transpRua').value.trim();
  const transpBairro = document.getElementById('transpBairro').value.trim();
  const transpCidade = document.getElementById('transpCidade').value.trim();
  const transpCep = document.getElementById('transpCep').value.trim();
  const transpEstado = document.getElementById('transpEstado').value.trim();

  if(!destNome){
    alert('Preencha ao menos o nome do destinatário antes de gerar as etiquetas.');
    return;
  }

  // Preview na tela
  const previewArea = document.getElementById('labelPreviewArea');
  previewArea.innerHTML = '<div class="section-title" style="margin-top:14px;">Prévia (' + qty + ' etiqueta' + (qty>1?'s':'') + ')</div>';

  // Área de impressão (uma etiqueta por página)
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';

  for(let i = 1; i <= qty; i++){
    const weightLine = weight ? ('<div class="lbl-line">Peso: ' + escapeHtml(weight) + ' kg</div>') : '';

    const labelHtml = `
      <div class="lbl-title">PEDIDO: ${escapeHtml(orderRef)}</div>
      ${notaFiscal ? '<div class="lbl-line">NF: ' + escapeHtml(notaFiscal) + '</div>' : ''}
      <div class="lbl-vol">VOLUME: ${i}/${qty}</div>
      ${weightLine}
      <div class="lbl-block-title">Destinatário:</div>
      <div class="lbl-line"><b>${escapeHtml(destNome)}</b></div>
      <div class="lbl-line">Rua: ${escapeHtml(destRua)}</div>
      <div class="lbl-line">Bairro: ${escapeHtml(destBairro)}</div>
      <div class="lbl-line">Cidade: ${escapeHtml(destCidade)}</div>
      <div class="lbl-line">Cep: ${escapeHtml(destCep)}  Estado: ${escapeHtml(destEstado)}</div>
      <div class="lbl-block-title">Transportadora:</div>
      <div class="lbl-line"><b>${escapeHtml(transpNome)}</b></div>
      <div class="lbl-line">Rua: ${escapeHtml(transpRua)}</div>
      <div class="lbl-line">Bairro: ${escapeHtml(transpBairro)}</div>
      <div class="lbl-line">Cidade: ${escapeHtml(transpCidade)}</div>
      <div class="lbl-line">Cep: ${escapeHtml(transpCep)}  Estado: ${escapeHtml(transpEstado)}</div>
    `;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'label-preview';
    previewDiv.innerHTML = labelHtml;
    previewArea.appendChild(previewDiv);

    const printDiv = document.createElement('div');
    printDiv.className = 'print-label';
    printDiv.innerHTML = labelHtml;
    printArea.appendChild(printDiv);
  }

  window.print();
}
