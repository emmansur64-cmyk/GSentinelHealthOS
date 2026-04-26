const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Cambia este valor por el mismo token que usarás en Meta.
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'WABIZ_VERIFY_2026_GSENTINEL';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const ENFORCE_SIGNATURE = String(process.env.WHATSAPP_ENFORCE_SIGNATURE || 'false').toLowerCase() === 'true';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const AUTO_REPLY_TEXT = process.env.WHATSAPP_AUTO_REPLY_TEXT || 'Hola. Recibimos tu mensaje y te responderemos en breve.';
const LOG_DIR = path.join(__dirname, 'logs');
const INCOMING_LOG_PATH = path.join(LOG_DIR, 'incoming-messages.jsonl');
const OUTGOING_LOG_PATH = path.join(LOG_DIR, 'outgoing-messages.jsonl');

function safeErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function timingSafeEqualHex(a, b) {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function isValidMetaSignature(req) {
  if (!ENFORCE_SIGNATURE) {
    console.log('Validacion de firma desactivada (WHATSAPP_ENFORCE_SIGNATURE=false).');
    return true;
  }

  if (!APP_SECRET) {
    console.log('WHATSAPP_APP_SECRET no configurado. Se omite validacion de firma.');
    return true;
  }

  const signatureHeader = String(req.get('x-hub-signature-256') || '').trim();
  if (!signatureHeader.startsWith('sha256=')) {
    console.log('Firma ausente o invalida en headers.');
    return false;
  }

  const expectedHex = crypto.createHmac('sha256', APP_SECRET).update(req.rawBody || '').digest('hex');
  const receivedHex = signatureHeader.slice('sha256='.length);

  try {
    return timingSafeEqualHex(expectedHex, receivedHex);
  } catch {
    return false;
  }
}

async function appendJsonLine(filePath, payload) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const line = `${JSON.stringify(payload)}\n`;
  await fs.appendFile(filePath, line, 'utf8');
}

async function sendWhatsAppTextMessage(to, text) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.log('No se envia auto-respuesta: falta WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID.');
    return { sent: false, reason: 'missing_config' };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: text,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Error Meta send message (${response.status}): ${responseText}`);
  }

  return { sent: true, status: response.status, body: responseText };
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.get('/webhook', (req, res) => {
  const mode = String(req.query['hub.mode'] || '').trim();
  const token = String(req.query['hub.verify_token'] || '').trim();
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === String(VERIFY_TOKEN).trim()) {
    console.log('Webhook verificado correctamente.');
    return res.status(200).send(challenge);
  }

  console.log('Error de verificacion del webhook. Token invalido o modo incorrecto.');
  return res.status(200).send('Verificacion no valida');
});

app.post('/webhook', (req, res) => {
  console.log('Evento recibido en /webhook');

  // Responder 200 inmediatamente evita reintentos agresivos de Meta.
  res.sendStatus(200);

  Promise.resolve().then(async () => {
    if (!isValidMetaSignature(req)) {
      console.log('Firma invalida. Evento ignorado.');
      return;
    }

    const body = req.body;
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];

        for (const message of messages) {
          const from = message.from || 'desconocido';
          const messageType = message.type || 'desconocido';
          const messageText = message?.text?.body || '';

          if (messageText) {
            console.log(`[Mensaje] De: ${from} | Tipo: ${messageType} | Texto: ${messageText}`);
          } else {
            console.log('[Mensaje] De:', from, '| Tipo:', messageType, '| Payload:', JSON.stringify(message));
          }

          await appendJsonLine(INCOMING_LOG_PATH, {
            ts: new Date().toISOString(),
            from,
            type: messageType,
            text: messageText,
            raw: message,
          });

          if (messageType === 'text' && from !== 'desconocido') {
            try {
              const sendResult = await sendWhatsAppTextMessage(from, AUTO_REPLY_TEXT);
              await appendJsonLine(OUTGOING_LOG_PATH, {
                ts: new Date().toISOString(),
                to: from,
                type: 'text',
                text: AUTO_REPLY_TEXT,
                status: sendResult.status || null,
                sent: sendResult.sent,
                body: sendResult.body || null,
              });
              if (sendResult.sent) {
                console.log(`[AutoReply] Enviado a ${from}`);
              }
            } catch (error) {
              console.error(`[AutoReply] Error enviando a ${from}:`, safeErrorMessage(error));
              await appendJsonLine(OUTGOING_LOG_PATH, {
                ts: new Date().toISOString(),
                to: from,
                type: 'text',
                text: AUTO_REPLY_TEXT,
                sent: false,
                error: safeErrorMessage(error),
              });
            }
          }
        }
      }
    }

    if (!entries.length) {
      console.log('Payload recibido (sin mensajes):', JSON.stringify(body));
      await appendJsonLine(INCOMING_LOG_PATH, {
        ts: new Date().toISOString(),
        type: 'non_message_event',
        raw: body,
      });
    }
  }).catch((error) => {
    console.error('Error procesando webhook:', safeErrorMessage(error));
  });
});

app.listen(PORT, () => {
  console.log(`Servidor webhook corriendo en http://localhost:${PORT}`);
  console.log(`Verify Token actual: ${VERIFY_TOKEN}`);
  console.log(`Firma HMAC activa: ${ENFORCE_SIGNATURE ? 'SI' : 'NO (modo desarrollo)'}`);
  console.log(`Auto-reply activa: ${ACCESS_TOKEN && PHONE_NUMBER_ID ? 'SI' : 'NO (faltan tokens Meta)'}`);
});