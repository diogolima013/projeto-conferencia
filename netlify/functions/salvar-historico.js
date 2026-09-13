// netlify/functions/salvar-historico.js
//
// Salva, na Planilha Google, uma linha por item conferido, quando um
// pedido é marcado como completo (botão "Gerar e imprimir etiquetas").
//
// Chamado pelo front-end assim (POST):
//   {
//     numero_pedido: "5",
//     cliente: "Nayara Serviços Ltda",
//     conferido_por: "Diogo",
//     itens: [{ descricao: "Camisa Polo Azul - M", esperado: 3, contado: 3 }, ...]
//   }
//
// Variáveis de ambiente necessárias no Netlify:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY
//   GOOGLE_SHEET_ID

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return resposta(405, { erro: 'Use POST.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return resposta(400, { erro: 'JSON inválido no corpo da requisição.' });
  }

  const { numero_pedido, cliente, conferido_por, itens } = body;

  if (!numero_pedido || !Array.isArray(itens) || itens.length === 0) {
    return resposta(400, { erro: 'Informe numero_pedido e uma lista de itens.' });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const chavePrivada = (process.env.JSON_GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !chavePrivada || !sheetId) {
    return resposta(500, { erro: 'Credenciais do Google não configuradas no Netlify.' });
  }

  try {
    const accessToken = await obterTokenDeAcesso(email, chavePrivada);
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const linhas = itens.map((item) => [
      agora,
      String(numero_pedido),
      cliente || '',
      item.descricao || '',
      item.esperado,
      item.contado,
      item.contado >= item.esperado ? 'Completo' : 'Faltando',
      conferido_por || '',
    ]);

    await adicionarLinhas(sheetId, accessToken, linhas);

    return resposta(200, { ok: true, linhas_salvas: linhas.length });
  } catch (err) {
    return resposta(502, { erro: 'Falha ao salvar na planilha.', detalhe: String(err) });
  }
};

// Monta e assina um JWT com a chave privada da conta de serviço, e troca
// esse JWT por um token de acesso OAuth2 (fluxo padrão do Google).
async function obterTokenDeAcesso(email, chavePrivada) {
  const agora = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    })
  );

  const assinatura = crypto
    .createSign('RSA-SHA256')
    .update(header + '.' + payload)
    .sign(chavePrivada);

  const jwt = header + '.' + payload + '.' + base64url(assinatura);

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' +
      encodeURIComponent(jwt),
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error('Não foi possível obter token do Google: ' + JSON.stringify(data));
  }
  return data.access_token;
}

// Adiciona linhas ao final da planilha (aba padrão, primeira aba).
async function adicionarLinhas(sheetId, accessToken, linhas) {
  const url =
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    sheetId +
    '/values/A1:append?valueInputOption=USER_ENTERED';

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: linhas }),
  });

  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error('Google Sheets respondeu ' + resp.status + ': ' + texto);
  }
}

function base64url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}