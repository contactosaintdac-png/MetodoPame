# Método Pame | Home Detail

Plataforma web de gestión de cuidado residencial premium para Pamela Mota — Tijucas, SC, Brasil.
El objetivo es que el sitio funcione de forma completamente autónoma, sin que Pame tenga que responder llamadas ni mensajes para cerrar contratos.

**URL en producción:** https://metodopame.com
**Stack:** React + TypeScript + Vite + Tailwind CSS + Firebase + Vercel

---

## Cómo correr el proyecto localmente

**Prerequisitos:** Node.js v18+

```bash
npm install
```

Crear `.env.local` con las variables de entorno (ver sección abajo), luego:

```bash
npm run dev
```

Abrir http://localhost:5173

---

## Variables de entorno (.env.local)

Copiar `.env.example` y rellenar con los valores reales:

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (ej. `proyecto.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | ID del proyecto Firebase (ej. `prospectadac`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `FIREBASE_PROJECT_ID` | ID del proyecto para Firebase Admin SDK (Vercel Functions) |
| `FIREBASE_CLIENT_EMAIL` | Email del service account para Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Private key del service account (con `\n` escapados) |
| `RESEND_API_KEY` | API key de Resend para envío de emails transaccionales |
| `MP_ACCESS_TOKEN` | Access token de Mercado Pago (Pix + Cartão) |
| `GOOGLE_CLIENT_ID` | Client ID de Google Calendar API |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Calendar API |
| `GOOGLE_REFRESH_TOKEN` | Refresh token de Google Calendar API |
| `GOOGLE_CALENDAR_ID` | ID del calendario de Pame en Google Calendar |
| `WHATSAPP_API_TOKEN` | Token de la Meta Cloud API para WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID de WhatsApp Business |
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics 4 Measurement ID (opcional) |
| `VITE_META_PIXEL_ID` | Meta Pixel ID (opcional) |
| `VITE_CLARITY_ID` | Microsoft Clarity ID (opcional) |

> Para obtener los valores de Firebase Admin SDK, ir a Firebase Console →
> Configuración del Proyecto → Cuentas de servicio → Generar nueva clave privada.

---

## Cómo deployar

Los deploys a producción son automáticos vía Vercel al hacer push a `main`.

Para deploy manual:

```bash
npx vercel --prod --yes
```

Para desplegar solo las reglas de Firestore:

```bash
npx firebase-tools deploy --only firestore:rules
```

---

## Arquitectura del proyecto

El sitio tiene **dos flujos completamente independientes**:

- **Flujo Cliente** (`/`) — Lista de espera → Área do Cliente → Checkout → Reservas
- **Flujo Especialista** (`/equipe`) — Candidatura → Dashboard de capacitación (LMS) → Certificación

Una especialista nunca puede acceder al flujo del cliente ni ver precios. Son ecosistemas aislados.

### Límite del plan Vercel Hobby

El proyecto tiene un máximo de **12 Serverless Functions**. Las funciones del LMS (`generate-final-exam`, `grade-final-exam`, `migrate-employees`) están consolidadas en un único endpoint `api/lms.ts` con dispatch por parámetro `?action=` para respetar este límite.

---

## Documentación

| Archivo | Descripción |
|---|---|
| [`PROJETO.md`](./PROJETO.md) | Fuente de verdad del proyecto: decisiones, cambios, pendientes, arquitectura |
| [`Documentacion/`](./Documentacion/) | Manuales de marca, dossier del avatar, oferta de servicios |
| [`firestore.rules`](./firestore.rules) | Reglas de seguridad de Firestore (siempre deployar tras modificar) |
| [`vercel.json`](./vercel.json) | Configuración de Vercel: crons, rewrites, routing |