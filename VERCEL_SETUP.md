# Configuración y Despliegue en Vercel

Este documento explica paso a paso cómo crear una cuenta en Vercel, conectar tu proyecto, configurar las variables de entorno necesarias (API keys) y realizar el despliegue para que las notificaciones por correo funcionen correctamente mediante **Vercel Functions**.

---

## 1. Crear una Cuenta en Vercel y Resend
1. Ve a [vercel.com](https://vercel.com/) y regístrate usando tu cuenta de GitHub (recomendado).
2. Ve a [resend.com](https://resend.com/) y regístrate para obtener una cuenta gratuita.
3. En Resend, ve a la sección **API Keys** y crea una nueva. Cópiala; la necesitarás para Vercel.
4. En Resend, también debes añadir y verificar tu dominio o configurar un remitente de prueba.

## 2. Configurar Firebase para Vercel (Service Account)
Para que el Cron Job (recordatorio 24h) pueda leer la base de datos automáticamente sin un usuario conectado, necesitamos las credenciales de Firebase Admin:
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Entra a **Configuración del Proyecto** (rueda dentada) > **Cuentas de Servicio**.
3. Haz clic en **Generar nueva clave privada**.
4. Esto descargará un archivo `.json`. Ábrelo; necesitarás su contenido para las variables de entorno en Vercel.

## 3. Conectar el Proyecto a Vercel
1. Sube este proyecto a un repositorio en **GitHub**.
2. En tu dashboard de Vercel, haz clic en **Add New... > Project**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio de Método Pame.
4. Vercel detectará automáticamente que es un proyecto de React/Vite.

## 4. Agregar Variables de Entorno en Vercel
Antes de hacer clic en "Deploy", despliega la sección **Environment Variables** (o ve a los Settings del proyecto si ya lo creaste) y añade las siguientes claves:

- `RESEND_API_KEY` = (Pega la API Key que copiaste de Resend)
- `FIREBASE_PROJECT_ID` = (El ID de tu proyecto de Firebase, por ejemplo `metodo-pame-xyz`)
- `FIREBASE_CLIENT_EMAIL` = (El valor `client_email` del archivo JSON de tu Service Account)
- `FIREBASE_PRIVATE_KEY` = (El valor `private_key` del archivo JSON de tu Service Account. **Importante:** Vercel preserva los saltos de línea `\n`).

Además, no olvides añadir tus variables normales de frontend si las usas (e.g., `VITE_FIREBASE_API_KEY`).

## 5. Desplegar
1. Haz clic en **Deploy**.
2. Vercel construirá la aplicación frontend y automáticamente empaquetará la carpeta `/api` como funciones sin servidor (Serverless Functions).
3. Una vez finalizado, el sistema te dará la URL pública de tu sitio.

## 6. Configurar el Cron Job (Recordatorios de 24h)
Hemos incluido un archivo `vercel.json` en la raíz del proyecto. Vercel leerá automáticamente este archivo y programará la función `/api/send-reminder` para ejecutarse todos los días a las 10:00 AM (UTC).

---

Con esto, el panel de administración, el flujo de reservas y los recordatorios por correo enviarán notificaciones reales utilizando Resend.
