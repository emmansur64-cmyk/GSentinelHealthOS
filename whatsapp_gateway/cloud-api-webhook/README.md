# Webhook simple para WhatsApp Business Cloud API

Proyecto minimo con Node.js + Express para recibir eventos de WhatsApp Cloud API.

## 1) Requisitos previos

1. Tener Node.js instalado (version 18 o superior).
2. Tener una cuenta de Meta Developers con WhatsApp Cloud API.
3. Tener ngrok instalado (o usar ngrok con comando directo).

## 2) Instalar dependencias

1. Abre terminal en esta carpeta.
2. Ejecuta:

```bash
npm install
```

3. Crea tu archivo .env copiando .env.example y completando valores reales.

PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

## 3) Definir tu Verify Token

1. En la misma terminal, define una variable de entorno.

PowerShell (Windows):

```powershell
$env:WHATSAPP_VERIFY_TOKEN="WABIZ_VERIFY_2026_GSENTINEL"
```

2. Ese mismo valor debes pegarlo luego en Meta como Verify token.

Si usas .env, no hace falta definir variables con $env cada vez.

## 3.1) Definir variables para firma y auto-respuesta

PowerShell (Windows):

```powershell
$env:WHATSAPP_APP_SECRET="TU_APP_SECRET_DE_META"
$env:WHATSAPP_ACCESS_TOKEN="TU_ACCESS_TOKEN_PERMANENTE_O_TEMPORAL"
$env:WHATSAPP_PHONE_NUMBER_ID="TU_PHONE_NUMBER_ID"
$env:WHATSAPP_API_VERSION="v21.0"
$env:WHATSAPP_AUTO_REPLY_TEXT="Hola. Recibimos tu mensaje y te responderemos en breve."
```

Donde sacar cada dato:

1. WHATSAPP_APP_SECRET: Meta Developers > App Settings > Basic > App Secret.
2. WHATSAPP_ACCESS_TOKEN: WhatsApp > API Setup > Temporary/Permanent Access Token.
3. WHATSAPP_PHONE_NUMBER_ID: WhatsApp > API Setup > Phone number ID.

## 4) Levantar el servidor

1. Ejecuta:

```bash
npm start
```

2. Debes ver algo como:

- Servidor webhook corriendo en http://localhost:3000

## 5) Exponer localhost con ngrok

1. Abre otra terminal (deja el servidor corriendo).
2. Ejecuta:

```bash
ngrok http 3000
```

3. Ngrok mostrara una URL publica, por ejemplo:

- https://abc12345.ngrok-free.app

## 6) Construir tu Callback URL

1. Toma la URL publica de ngrok.
2. Agrega /webhook al final.
3. Ejemplo final:

- https://abc12345.ngrok-free.app/webhook

Ese es tu Callback URL.

Callback URL para tu ngrok actual:

- https://immature-pug-reroute.ngrok-free.dev/webhook

Verify Token recomendado para usar ahora:

- WABIZ_VERIFY_2026_GSENTINEL

## 7) Pegar Callback URL en Meta

1. Entra a Meta for Developers.
2. Ve a tu App.
3. Abre WhatsApp > Configuration.
4. En la seccion Webhook:
   - Callback URL: pega tu URL de ngrok con /webhook
   - Verify token: pega exactamente el mismo token que pusiste en WHATSAPP_VERIFY_TOKEN
5. Haz clic en Verify and Save.

Si esta bien, Meta verificara tu endpoint con GET /webhook y el servidor respondera el challenge automaticamente.

## 8) Verificar que funciona

1. En Meta, suscribe el campo messages del webhook.
2. Envia un mensaje de prueba al numero de WhatsApp Business de tu app.
3. Mira la terminal del servidor:
   - Debe imprimir el contenido de los mensajes.
   - Debe mostrar AutoReply enviado cuando llegue un texto.
4. El servidor siempre responde 200 en POST /webhook.

## 8.1) Revisar logs guardados

El servidor guarda mensajes en archivos JSONL:

1. logs/incoming-messages.jsonl
2. logs/outgoing-messages.jsonl

Cada linea es un JSON independiente para auditoria y debugging.

## 9) Prueba rapida opcional (sin Meta)

Puedes probar POST /webhook manualmente:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"5491112345678","type":"text","text":{"body":"Hola webhook"}}]}}]}]}'
```

Debe devolver HTTP 200 y mostrar el mensaje en consola.

## 10) Despliegue estable (sin ngrok) para produccion

Opcion recomendada: Render o Railway.

1. Sube esta carpeta a GitHub.
2. Crea un nuevo servicio Web en Render/Railway.
3. Build command: npm install
4. Start command: npm start
5. Port: 3000
6. Carga estas variables de entorno en el panel:
   - WHATSAPP_VERIFY_TOKEN
   - WHATSAPP_APP_SECRET
   - WHATSAPP_ACCESS_TOKEN
   - WHATSAPP_PHONE_NUMBER_ID
   - WHATSAPP_API_VERSION
   - WHATSAPP_AUTO_REPLY_TEXT
7. Toma la URL publica del deploy y agrega /webhook.
8. En Meta, reemplaza el Callback URL de ngrok por el URL del deploy.

Ejemplo:

- https://tu-app.onrender.com/webhook