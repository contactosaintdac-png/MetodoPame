# PROJETO.md — Memoria Permanente del Proyecto
## MÉTODO PAME | Home Detail

> Este archivo es la fuente de verdad del proyecto. Leelo completo antes de tocar cualquier cosa.
> 
> **Regra Obrigatória para a IA / Clases de actualizaciones que deben registrarse en PROJETO.md:**
> Este documento debe actualizarse de forma autónoma y sin necesidad de recordatorios siempre que ocurra alguna de las siguientes clases de actualizaciones:
> 1. **Novas Funcionalidades / Componentes**: Creación o modificación de pantallas, componentes de UI, flujos de navegación (ej. Área del Cliente, Checkout, Panel Admin, etc.).
> 2. **Regras de Negócio, Campañas y Precios**: Cambios en tarifas bases, reglas de precios dinámicos, promociones, descuentos, campañas de referidos (ej. Círculo de Excelência).
> 3. **Seguridad, Roles y Acceso**: Modificaciones en roles de usuario (admin, cliente, especialista), lógica de gating de rutas, validación de permisos en base de datos.
> 4. **Integrações e APIs**: Cambios en integraciones externas como Resend, Mercado Pago, Google Calendar, WhatsApp API.
> 5. **Arquitetura de Dados**: Nuevas colecciones, subcolecciones, campos clave o reglas de seguridad en Firestore.
> 6. **Estado do Projeto (Pendientes y Concluidos)**: Actualización de la lista de tareas de la Sección 18 para reflejar fielmente lo completado y los próximos pasos.
> 
> **REGLAS CRÍTICAS DE DESARROLLO / INTEGRACIÓN CONTINUA:**
> - **REGLA DE ORO DE GIT / DEPLOY:** Ante **CUALQUIER MODIFICACIÓN** al código o documentación (por más pequeña, mínima o simple que sea, incluyendo correcciones ortográficas, de formato, de configuración, comentarios o lógica), la IA **DEBE REALIZAR UN GIT PUSH** (`git add .`, `git commit -m "..."`, `git push`) de forma obligatoria e inmediata. No esperar confirmación ni acumular cambios. El pipeline de Vercel/CI-CD depende de esto para que el cliente pruebe los cambios de inmediato.

---

## 1. Qué es este proyecto

Plataforma web para el negocio de limpieza residencial de alto padrón de Pamela Mota en Tijucas, SC, Brasil. El objetivo es que el site funcione de forma completamente autónoma — sin que Pame tenga que responder llamadas ni mensajes para cerrar contratos.

**URL en producción:** `https://metodopame.com`
**Repositorio:** Local en Windows, conectado a Vercel via GitHub
**Stack:** React + TypeScript + Vite + Tailwind CSS + Framer Motion

---

## 2. Stack tecnológico completo

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Animaciones | Framer Motion (motion/react) |
| Auth | Firebase Authentication (Google Auth para clientes) |
| Base de datos | Firebase Firestore |
| Backend serverless | Vercel Functions (`/api/`) |
| Emails | Resend |
| Pagos | Mercado Pago (Pix + Cartão) |
| Calendario | Google Calendar API |
| Deploy | Vercel (gratuito, sin tarjeta) |
| Idioma | 100% Português Brasileiro |
| Optimización | Mobile-first |
| Directrices de Diseño IA | Taste Skill (Estándar anti-slop para agentes de UI) |

---

## 3. Identidad visual

- **Estética:** Quiet Luxury
- **Color principal:** Morado `#561668`
- **Fondo:** Blanco `#ffffff` com textura sutil e estática de ruído/grão de papel (`body::after` com opacidade `0.012`)
- **Tipografía:** Display Serif elegante (**Cormorant Garamond** em itálico para cabeçalhos e títulos principais) pareada com Sans-serif geométrica (**Manrope** para corpo e elementos de UI)
- **Tono de marca:** Elegante, femenino, alto padrón

---

## 4. Arquitectura — Dos mundos separados

El site tiene DOS flujos completamente independientes desde la entrada:

### Flujo Cliente → `/` (split screen)
Botón "Para Residências" → Lista de Espera (Acesso Prioritário) o Login directo (para clientes activos) → Área do Cliente (Triage y Checkout restringido)

### Flujo Funcionária → `/equipe`
Formulario de candidatura independiente. Sin ninguna conexión con el flujo del cliente. Sin precios, sin datos comerciales.

**Regla crítica:** Una funcionaria NUNCA puede acceder al flujo del cliente ni ver precios. Son ecosistemas aislados.

---

## 5. Flujo del cliente detallado

### Lista de Espera (Acesso Prioritário)
Para controlar la demanda inicial, los clientes residenciales nuevos son dirigidos a la Lista de Espera (`/lista`):
- **Formulario**: Captura `name`, `whatsapp`, `email`, `neighborhood`, `serviceType`, y `source` (origen de contacto).
- **Referidos**: Si hay una recomendación activa (`pame_referrer_uid` en localStorage), se asocian `referredByUid` y `referredByName` al registro en Firestore para darle prioridad.
- **Acción Viral**: La pantalla de éxito incluye un botón para "Indicar uma Amiga" vía WhatsApp con un mensaje pre-formateado.

### Avaliação da Residência (antes llamado "Triage" — NO usar ese nombre)
Clientes aprobados o pre-registrados acceden a este flujo de 4 pasos obligatorios antes de ver la Matriz de Investimento:

1. **Histórico Recente** — ¿Cuándo fue la última limpieza profunda?
   - Há menos de 7 dias
   - Entre 15 e 30 dias
   - Há mais de 30 dias ou Pós-obra

2. **Dimensões do Espaço** — Quartos, Banheiros, Andares (selectores numéricos)

3. **Superfícies Nobres** — Mármore, Madeira Maciça, Vidros Duplos, Cristais e Lustres

4. **Frequência Desejada** — Pacote Mensal (recomendado) o Serviço Avulso

**Regla:** El cliente que ya completó la Avaliação NO la vuelve a ver. Va directo a su Área do Cliente.

**Mensaje de bienvenida si está logueado:** *"Bem-vinda, [Nome]. O seu lar merece o melhor cuidado."*

---

## 6. Precios — Matriz de Investimento

### Precios base (casa estándar: hasta 3 quartos, 2 banheiros, 1 andar)

| Turno | Avulso | Pacote Mensal (4x) | Economia |
|---|---|---|---|
| Meio Turno (4h) 08:00–12:00 o 13:00–17:00 | R$ 350 | R$ 1.200 | R$ 200/mês |
| Turno Completo (9h) 08:00–17:00 | R$ 450 | R$ 1.500 | R$ 300/mês |

**Lógica Decoy:** El precio avulso es deliberadamente alto para hacer obvio el paquete mensual.

### Precios dinámicos por tamaño de residencia
A partir de la casa base, cada elemento adicional suma:
- +R$ 50 por quarto extra
- +R$ 30 por banheiro extra  
- +R$ 80 por andar extra

### Campanha de Recomendação — Círculo de Excelência
Para incentivar contratos de mensalistas (*faxinas fixas*), aplica-se a seguinte regra de desconto dinâmico no Checkout:
- **Quem indica (Referente)**: Ganha **1 Faxina Completa Full Detail de cortesia** quando o amigo indicado fecha o primeiro mês de um *Pacote Mensal* (4 visitas).
- **Quem é indicado (Referido)**: Ganha **R$ 100 de desconto** no primeiro mês de contratação de qualquer *Pacote Mensal*.
  - *Lógica no Checkout*: O sistema detecta a chave `pame_referrer_uid` no localStorage (previamente capturada da URL em `App.tsx`) e subtrai R$ 100 del total en el momento de la contratación de un paquete mensual. Al confirmar la reserva, se guarda el `referrerUid` en Firestore, y se limpia el `pame_referrer_uid` del localStorage.
  - *Lógica na Lista de Espera*: Si la amiga recomendada se inscribe en la Lista de Espera, el sistema asocia `referredByUid` y `referredByName` en su registro en Firestore, priorizando su aprobación y manteniendo el descuento para cuando contrate el Pacote Mensal.

### Serviços Adicionais de Alta Gama (+R$ 50 cada uno)
1. Organização de Roupas
2. Passadoria de Roupas
3. Limpeza de Louças
4. Limpeza Interna de Eletrodomésticos
5. Polimento de Metais
6. Organização de Closets
7. Limpeza de Vidros
8. Organização de Despensa

---

## 7. Autenticación y roles

### Flujo de Validación y Gating de Rutas
La aplicación ejecuta una validación de cargo (`userRole`) mediante Firestore inmediatamente después del inicio de sesión (en `App.tsx`):
- Si el e-mail está en la colección `employees` con `status == 'active'`, el cargo es `specialist`.
- Si el e-mail es `metodopame.homedetail@gmail.com` o `contactosaintdac@gmail.com` (desarrollador), el cargo es `admin`.
- Cualquier otro usuario autenticado (mediante Google Auth) es calificado como `client`.

### Clientes
- Login con **Google Auth (Gmail)** — un clic, sin contraseña.
- Opcional — pueden contratar sin registrarse (guest checkout).
- Al loguearse sin reservas previas → van a la Avaliação da Residência.
- Al loguearse con reservas → van directo a Minha Área.
- **Seguridad estricta:** Si intentan acceder a `/admin`, son redirigidos automáticamente a la pantalla de bienvenida. En `/equipe`, se muestra un banner advirtiendo que ya tienen sesión de cliente iniciada.

### Funcionárias (Especialistas)
- Login con **email + contraseña generada por el sistema** (creada por Pame desde `/admin` o auto-generada desde `/equipe` al postularse).
- Acceso exclusivo en `/equipe`.
- **Seguridad estricta:** NUNCA pueden acceder al flujo de clientes ni ver precios. Si intentan ingresar a `/`, `/pricing` o `/minha-area`, la aplicación las redirige inmediatamente a `/equipe` de vuelta a su panel.

### Administrador (Pame + Dev)
- Acceso a `/admin` protegido para `metodopame.homedetail@gmail.com` y `contactosaintdac@gmail.com`.
- Ve todo — reservas, clientes, funcionárias, reportes financieros.

### Reglas de Seguridad en Firestore (firestore.rules)
La base de datos implementa restricciones de acceso estrictas y seguras:
- **Administradores (`isAdmin()`)**: Acceso completo de lectura y escritura en todas las colecciones.
- **Propietarios (`isOwner(userId)`)**: Los clientes solo pueden leer y escribir documentos dentro de su propio nodo de usuario (`/users/{userId}`).
- **Lista de Espera (`/waitlist`)**: Permiso de creación público (`allow create: if true`) para que cualquier visitante pueda registrarse, pero lectura y edición exclusivas del administrador.
- **Funcionarias (`/employees`)**: Creación pública permitida solo bajo estado `pending` y `active == false`. Las especialistas activas solo pueden leer su propio documento y actualizar campos no críticos (no pueden cambiar su email, status o flag de activación).
- **Asignaciones de Reservas (`collectionGroup bookings`)**: Las especialistas solo pueden realizar lecturas en la colección de reservas para aquellos documentos donde estén explícitamente asignadas (cruzando su email autenticado contra el ID de empleada asignada en la reserva).
- **Concierge Index (`/reservas_index`)**: Permite a clientes crear reservas (necesario para el checkout), pero la lectura y edición masiva está reservada para administradores y el backend seguro.

---

## 8. Área do Cliente (`/minha-area`)

Visible solo para clientes logueados. Rediseñada por completo bajo el estilo *Quiet Luxury / Silk & Stone* en 4 secciones unificadas (Abas):
- **Painel Geral (Dashboard)**: Bienvenida al cliente, estado de membresía, acceso rápido a faturas recientes, recomendaciones de servicios y acceso directo al agendamiento o pricing.
- **Minhas Reservas (Calendário)**: Calendario interactivo dinámico que cruza los datos de reservas del cliente en Firestore. Detalle del servicio seleccionado que muestra la especialista asignada (con avatar y nombre) y protocolos de lujo aplicados (Desinfección UV, Eco-Luxe, Silencioso).
- **Histórico & Faturas**: Tabla interactiva con faturas en formato PDF descargables e integración de evaluaciones con estrellas (1 a 5) que actualizan el rating directamente en Firestore en tiempo real.
- **Suporte & Concierge**: Sistema de Chat funcional con respuesta inteligente y automatizada de concierge (usando llamada directa a la API de Gemini para evitar conflictos de autenticación de Firebase en clientes logueados), formulario de solicitudes especiales (Catering, Transporte, etc.) que persiste requerimientos en Firestore con modal de confirmación, y sección de preguntas frecuentes colapsables. **Mecanismo de Limpieza de Chat:** Incluye un botón para limpiar el historial de chat del cliente de manera manual. Esto almacena un timestamp `clearChatAt` en el documento raíz del chat (`chats/{clientId}`). El cliente solo visualiza en su interfaz los mensajes posteriores a este timestamp (además del mensaje de bienvenida), pero todo el historial de consultas permanece intacto en Firestore para auditoría y visualización del Administrador en el panel.
- **Círculo VIP (Indicações / Aba 'indique')**: Painel exclusivo de recomendação que permite copiar o link de indicação exclusivo (`https://metodopame.com/?ref=UID`), compartilhar via botão do WhatsApp com mensagem pré-formatada e visualizar a lista de amigos indicados com seus respectivos status (*Pendente*, *Cortesia Liberada!*, *Usufruído*), incluindo um mecanismo de mock fallback elegante caso as regras de segurança del Firestore limitem consultas cruzadas de banco.
- **Navegación**: Totalmente aislada del flujo estándar, con barra lateral de alta fidelidad y botón para regresar al sitio principal.

---

## 9. Sistema de disponibilidad y asignación

### Cómo funciona
- Pame carga la disponibilidad de cada funcionaria manualmente en el panel admin
- Disponibilidad por día de la semana y turno (Meio Manhã / Meio Tarde / Completo)
- Al elegir fecha, el sistema cruza con disponibilidad en tiempo real
- Si no hay disponibilidad: muestra las próximas 5 fechas disponibles

### Algoritmo de asignación automática (Load Balancing)
Cuando el cliente confirma el pago:
1. Filtra funcionárias disponibles para esa fecha y turno exacto
2. Ordena por menor cantidad de servicios en el mes actual
3. Asigna a la que tiene menos trabajo (equidad)
4. Bloquea el slot en Firestore
5. Notifica al cliente, a Pame y a la funcionaria

**Pame puede reasignar manualmente desde el panel admin si lo desea.**

### Pacote Mensal — lógica de 4 fechas
El cliente elige un día de la semana → el sistema genera automáticamente las 4 fechas del mes (ej: 11/06, 18/06, 25/06, 02/07) → el cliente las revisa y aprueba → se verifican las 4 en cadena.

**TODO futuro:** Que las funcionárias gestionen su propia disponibilidad desde `/equipe`.

---

## 10. Formulario de funcionárias (`/equipe`)

Campos obligatorios:
- Nombre completo y fecha de nacimiento
- CPF (con validación)
- WhatsApp
- Foto profesional (upload)
- Tiempo de experiencia (mínimo declarado: 3 años)
- 2 referencias verificables de residencias de alto padrón
- Declaración de habilidades específicas (mármore, vaporizadores, vidros, etc.)
- Antecedentes criminales (upload PDF/JPG/PNG, máx 5MB)
- Bairros y zonas de Tijucas disponibles
- Tipo de turno disponible (Meio Manhã / Meio Tarde / Turno Completo)

**Auto-registro de Credenciales**: El formulario incluye campos para que la candidata ingrese su **E-mail** y **Senha**. Al enviar el formulario, el sistema crea automáticamente su cuenta en Firebase Auth en segundo plano (usando una instancia secundaria de Firebase para no desloguear al usuario actual) y guarda el registro en la colección `/employees` con `status: 'pending'`.

**Al enviar el formulario:** Aparece pantalla de confirmación con agendamiento del **"Café Virtual com a Pame"** — así se llama la entrevista. NUNCA llamarlo "entrevista".

**En el panel admin:** Pame puede aprobar o rechazar cada candidatura.

**Filtro legal importante:** NO rechazar por edad — eso es discriminación bajo la CLT brasileña. En cambio, exigir mínimo 3 años de experiencia comprobada. Resultado práctico idéntico, sin riesgo legal.

---

## 11. Panel Admin (`/admin`)

Acceso exclusivo para Pame y el desarrollador. Funcionalidades:
- Dashboard: reservas del día, ingresos, servicios pendientes
- Gestión de pedidos: ver, editar, cancelar reservas (Modo Dios)
- Visualização da Agenda: alternância dinâmica entre Vista de Lista e Calendário Mensal with badges interativos coloridos (lilás para atribuídos, vermelho/salmão para não atribuídos).
- Agenda general: Google Calendar integrado (iframe responsivo)
- Gestión de clientes: perfiles, historial, paquetes activos
- Gestión de funcionárias: fichas, disponibilidad, credenciales, historial, activar/desactivar/eliminar
- Gestión de la Lista de Espera: Tab dedicado con métricas (Total, Pendientes, Registrados) que permite contactar por WhatsApp (plantillas), realizar el pre-registro (creación de cuenta en Firestore) o eliminar de la lista.
- Revisión de candidaturas: aprobar o rechazar con opción de agendar Café Virtual
- Reportes financieros: ingresos por mes, servicios por tipo, add-ons más contratados
- Gestão de Indicações (Círculo VIP): Visualização de estatísticas gerais da campanha de recomendação e controle total das cortesías geradas (status pendente, liberada ou usufruída) para referentes e indicados.

---

## 12. Backend serverless — Vercel Functions (`/api/`)

**Por qué Vercel y no Firebase Functions:** Firebase Functions requiere plan Blaze con tarjeta de crédito. Vercel es gratuito sin tarjeta.

### Funciones implementadas:
- `send-confirmation.ts` — email al cliente al confirmar pago
- `send-admin-notification.ts` — email a Pame cuando entra reserva nueva
- `send-specialist-assignment.ts` — email a la funcionaria asignada
- `send-reminder.ts` — Cron Job diario 10:00 AM, busca servicios del día siguiente y envía recordatorios
- `create-preference.ts` — Crea la preferencia de pago en la API de Mercado Pago
- `create-calendar-event.ts` — Crea el evento en Google Calendar usando una Service Account de Google Cloud de forma segura
- `chat.ts` — Chatbot Concierge impulsado por **Llama 3.3 70B Instruct en NVIDIA NIM con Function Calling nativo**. La IA puede ejecutar acciones reales en la base de datos (buscar, reagendar, cancelar y crear reservas).

### Variables de entorno en Vercel (configurar en dashboard):
```
RESEND_API_KEY=           ← API key de Resend
ADMIN_EMAIL=metodopame.homedetail@gmail.com  ← Email de Pame ✓ CONFIGURADO
PAME_EMAIL=metodopame.homedetail@gmail.com   ← Email explícito de Pame para Concierge IA
DEV_EMAIL=contactosaintdac@gmail.com         ← Email dev para auditoría de acciones IA
VITE_FIREBASE_API_KEY=    ← Firebase
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_MP_PUBLIC_KEY=       ← Mercado Pago (frontend)
MP_ACCESS_TOKEN=          ← Mercado Pago (backend, NUNCA en frontend)
FIREBASE_PROJECT_ID=      ← Firebase Admin (para Cron Job y Concierge IA)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NVIDIA_API_KEY=           ← API Key de NVIDIA NIM ✓ CONFIGURADO — Requerida para el Concierge IA
GEMINI_API_KEY=           ← API Key de Gemini (opcional / legacy)
OPENAI_API_KEY=           ← API Key de OpenAI (opcional / legacy)
```

---

## 13. Emails — Resend

**Plan gratuito:** 3.000 emails/mes — suficiente para el volumen inicial de Pame.

**Estado actual:** Totalmente activo y configurado. El dominio propio (`metodopame.com`) ha sido verificado en Resend. Los correos se envían de forma segura desde `reservas@metodopame.com` hacia los clientes, especialistas, Pame y auditoría del desarrollador.

---

## 14. Mercado Pago

**Estado actual:** Integración preparada y probada.

**TODO pendiente:** 
*(Pagos implementados y funcionando en Vercel API)*

**Flujo de pago:** El pago ocurre ANTES del servicio. La funcionaria no recibe dinero — todo va a Pame.

---

## 15. Google Calendar

**Estado actual:** **Totalmente integrado y activo** (tanto en sincronización en segundo plano como en visualización frontend).

**Arquitectura de seguridad:** El frontend llama al endpoint seguro `/api/create-calendar-event`. Esta Vercel Function firma digitalmente las solicitudes (RS256) usando una **Service Account de Google Cloud** cargada de manera segura mediante variables de entorno en el backend (`GOOGLE_SERVICE_ACCOUNT_KEY` O `GOOGLE_CALENDAR_ID`), manteniendo las llaves privadas a salvo.
*Si las variables de entorno no están configuradas (por ejemplo, en desarrollo local), la API simula el agendamiento de forma exitosa sin interrumpir la experiencia de usuario (graceful fallback).*

**Funcionalidades de Calendario:**
- **Visualización en Admin (/admin):** Los administradores pueden alternar en la pestaña de Agenda entre la vista de lista, la vista de calendario de Firestore y el **Google Calendar real integrado** (mediante un iframe responsivo conectado a `VITE_GOOGLE_CALENDAR_ID`).
- **Creación automática de eventos:**
  - Automático al confirmar una reserva (con todos los detalles del cliente, turno, aditivos y especialista asignada).
  - Automático al agendar un **Café Virtual** (candidata a especialista) desde la pantalla de éxito del formulario `/equipe`.
- **En el calendario del cliente:** Botón "Adicionar à minha agenda" (link de plantilla manual para Google Calendar personal, sin requerir permisos de la API).

---

## 16. Notificaciones

**Email (Resend):** Totalmente activo y configurado. Las notificaciones automáticas se envían de forma segura desde `reservas@metodopame.com` en cada evento crítico (cambio de fecha por IA, cancelación, confirmaciones de reserva y asignación de especialistas).

**WhatsApp:** Para el futuro cuando el negocio esté facturando. Usar WhatsApp Business API via 360dialog. Costo: ~R$ 0,05 por mensaje de tipo Utility. Para el volumen de Pame: ~R$ 3-8/mes.

---

## 17. Decisiones de negocio tomadas — NO cambiar sin consultar a Pame

- ✅ Precios definidos (ver sección 6)
- ✅ Casa base definida: 3 quartos, 2 banheiros, 1 andar
- ✅ Recargos por tamaño definidos (ver sección 6)
- ✅ Email de Pame: `metodopame.homedetail@gmail.com`
- ✅ Matching automático con load balancing (Pame puede reasignar manualmente)
- ✅ Login con Google solo para clientes (funcionárias usan email+contraseña)
- ✅ La entrevista se llama "Café Virtual com a Pame" — NUNCA "entrevista" (Es un paso exclusivo de selección para funcionarias/candidatas, NO para clientas).
- ✅ Cambios en Avaliação da Residência aplican solo a nuevas reservas, no al paquete activo
- ✅ El triage se llama "Avaliação da Residência" — NUNCA "triage" ni "triagem"
- ✅ **Campanha de Recomendação Círculo de Excelência:** Se implementó y activó por completo la campaña automatizada en el site (detección de `?ref`, descuento de R$ 100 automático en checkout y panel de control de referidos en admin). Pame puede alternar entre la campaña automatizada digital y la difusión manual por WhatsApp según convenga.

---

## 18. Rastreamento e Analytics

Se encuentra implementado el rastreo de eventos y visitas de usuarios en producción:
- **Google Analytics (`VITE_GOOGLE_ANALYTICS_ID`)**: Rastreo básico de visitas a páginas y conversiones de checkout.
- **Meta Pixel (`VITE_META_PIXEL_ID`)**: Rastreo de eventos clave y conversiones.
- **Microsoft Clarity (`VITE_CLARITY_ID`)**: Grabación de sesiones e interacción de usuarios en producción.
- **Eventos de Conversión Activos (`tracking.ts`)**:
  - `Lead`: Detonado al completar con éxito el registro en la Lista de Espera (`WaitlistForm.tsx`).
  - `StartTriage`: Detonado al iniciar la Avaliação de Residência (`ClientTriage.tsx`).
  - `CompleteTriage`: Detonado al finalizar con éxito la Avaliação de Residência (`ClientTriage.tsx`).
  - `InitiateCheckout`: Detonado al hacer clic en los botones de agendamiento y abrir el modal de checkout (`PricingMatrix.tsx`).
  - `Purchase`: Detonado al confirmar una reserva con éxito y persistirla en la base de datos antes de la redirección de pago (`PricingMatrix.tsx`).
- **Lógica Resiliente**: Se cargan y disparan dinámicamente según variables de entorno de Vercel. Si no están declaradas, la inicialización no causa errores en consola (graceful exclusion).

---

## 19. Pendientes activos (en orden de prioridad)

### 🟢 Completado
- ~~**Diagnosticar error de Resend** — modificar funciones en `/api/` para loguear error completo~~ (Resuelto, emails funcionando)
- ~~**Implementar precios dinámicos** — buscar `// TODO: Implementar precio dinámico` en PricingMatrix.tsx~~ (Resuelto, lógica matemática en vivo)
- ~~**Verificar el dominio `metodopame.com` en Resend**~~ (Resuelto)
- ~~**Café Virtual com a Pame** — agregar pantalla de confirmación al final del formulario de funcionárias con agendamiento de videollamada y grabación en base de datos.~~ (Resuelto, selector visual de slots)
- ~~**Activar Google Calendar con service account real**~~ (Resuelto, Vercel Serverless Function `/api/create-calendar-event` segura e integrada)
- ~~**Isolamento de Ecosistemas (Gating)** — separación de flujos estricta cliente vs especialista en frontend y protección de admin para múltiples correos.~~ (Resuelto)
- ~~**Sistema de evaluaciones (estrellas) del cliente sobre el servicio**~~ (Resuelto, persistencia directa en Firestore)
- ~~**Renovación Premium de la Área del Cliente (`/minha-area`)**~~ (Resuelto, integración de las 4 pantallas del Stitch con interactividad completa)
- ~~**Calendário no Painel do Administrador (Maestro de Agendas)**~~ (Resuelto, toggle dinâmico lista/calendário com controle de meses e badges inteligentes)
- ~~**Google Calendar Frontend Toggle** — Integración visual del Google Calendar real de Pame en la pestaña Agenda de `/admin` mediante iframe alternable.~~
- ~~**Estrategia de Campaña de Recomendación** — Estruturación de copys y gráficos VIP de difusión manual en WhatsApp para clientes y ex-clientes para captación de clientes de emergencia (1 recomendado = 1 faxina gratis).~~
- **Autogestão de Disponibilidade** — Especialistas agora podem gerenciar a própria disponibilidade via interface interativa no dashboard de equipe.
- **Gating Dinâmico de Admins** — Bootstrapping automático via Firestore para validação de roles.
- **Tipagem Estrita (TypeScript) e UX** — Interfaces (`Employee`, `Booking`) padronizadas, remoção de telas e tabs não funcionais.
- **Campanha de Indicações Círculo de Excelência (Frontend & Lógica)** — Captura do parâmetro `?ref` na URL with salvamento e limpeza dinâmica de endereço (App.tsx), aplicação do desconto VIP de R$ 100 com banner explicativo no checkout (PricingMatrix.tsx), e aba de indicações activa no portal del cliente com botão do WhatsApp e lista de indicações con fallback de mock premium (MinhaArea.tsx).
- **Redesenho Visual Premium (Diretrizes Taste Skill)** — Importação e aplicação da fonte display serifada *Cormorant Garamond* em itálico para títulos principais, injeção de textura física de papel via ruído estático em CSS, estabilização de viewports móveis (`dvh`), micro-interações táteis `active-scale` nos cliques e implementação de Skeleton Loaders animados na Área de Clientes.
- **Painel de Gestão de Indicações no Admin** — Integração e redesenho da aba de controle da campanha de recomendação no painel da Pame com painel de estatísticas neumórficas, tabela de controle detalhada (Referente, Amigo, Status e Ações), filtros avanzados de busca/status, sincronización automática de perfis de clientes logados, criação manual híbrida de indicações e Modo Simulador interativo.
- **Sprint de Estabilização e Validações Gerais** — Lançamento da suite de validação e roteamento seguro de sessões:
  - **Recrutamento:** Máscaras de CPF/WhatsApp em tempo real, uploads obrigatórios de foto/antecedentes, slot restrito (17:30-20:00) para Café Virtual, e fallback resiliente da API de calendário con e-mail de alerta em caso de falha de token.
  - **Faturamento Real:** Utilitário `src/utils/invoice.ts` para geração de PDFs de faturas premium Quiet Luxury con botón de impresión interativa.
  - **Limpeza de UX na Área do Cliente:** Remoção de blocos obsoletos (catering/enxovais, recomendações), limpeza de protocolos fictícios em FAQs e redirecionamento de botões de reserva para o Checkout real.
  - **Painel da Especialista:** Agenda mensal com modo Calendário, configuração de disponibilidade em pílulas táteis semanais, edição protegida de perfil via Firestore `pendingUpdate` e integração del canal de ajuda via WhatsApp.
  - **Painel Admin:** Interface de aprovação/recusa de atualizações de funcionárias com comparación lado a lado, modal administrativo para agendar Café Virtual, e barra lateral enxuta sem links inativos.
  - **Roteamento Inteligente (App.tsx):** Redirecionamento instantâneo de administradores para `/admin`, triagem obrigatória automática para nuevos clientes, y livre tráfego para la página de precios `/pricing` para usuarios registrados.
- **Automatização de Registro de Especialistas (Funcionárias)** — Inclusão de campos de E-mail e Senha no formulario, creación de conta no Firebase Auth em segundo plano de forma isolada, e armazenamento em Firestore na coleção `/employees` em estado `pending` para conformidade con regras.
- **Rastreamento e Prontidão de Lançamento (Analytics, Pixel e Clarity)** — Criação do utilitário `src/lib/tracking.ts` integrado no projeto para inicialização dinâmica do Google Analytics (`VITE_GOOGLE_ANALYTICS_ID`), Meta Pixel (`VITE_META_PIXEL_ID`) e Microsoft Clarity (`VITE_CLARITY_ID`). Adicionalmente, implementamos rastreamento de conversão em pontos críticos: `Lead` (Lista de espera), `StartTriage`/`CompleteTriage` (Avaliação de Residência), `InitiateCheckout` e `Purchase` (Checkout/Agendamento).
- **Correções de Segurança e Búsqueda Global (Security Rules)** — Atualização e deploy del arquivo `firestore.rules` com suporte a consultas `collectionGroup` (agilizando o painel administrativo), regras de leitura para que as especialistas leiam apenas seus agendamentos, e de atualização restrita para que atualizem seus perfis de forma segura.
- **Sistema de Lista de Espera (Acesso Prioritário) e Redirecionamento** — Criação del componente `WaitlistForm.tsx` (`/lista`), redirecionamento de novos clientes residenciais para la lista, captura de código de indicação (`ref`), aba de gerenciamento no Painel Admin com envio de templates de WhatsApp, exclusão de registros e pré-registro direto (creación automatizada de perfis de clientes no Firestore).
- **Ajustes Legais (LGPD) e SEO Global** — Implantação de modais globais e responsivos de Política de Privacidade e Termos de Uso em `App.tsx` acionados por eventos globais de janela a partir do rodapé da Landing Page, Lista de Espera e Checkout. Atualización del `index.html` con metatags Open Graph e Twitter Cards globais apontando para o domínio canônico `https://metodopame.com/` e geração da imagem OG real de 1200x630px a partir do logo.
- **Calendário de Disponibilidade Visual no Checkout e Regra Implícita** — Substituição do input tradicional de data por uma grade de calendário mensal interativa que reflete a disponibilidade das especialistas em tempo real (com busca em lote e cache de 60 dias). Implementação de regras de disponibilidade implícita, onde a escala de Turno Completo (`completo`) atende automaticamente solicitações de Meio Turno (`meio_manha` ou `meio_tarde`), a menos que haja bloqueio explícito.
- **Página 404 Premium, Clarity e SEO Técnico** — Implementação do componente `NotFound.tsx` para tratamento elegante de caminhos inexistentes, suporte para Microsoft Clarity no arquivo `tracking.ts` por meio de variável de ambiente (`VITE_CLARITY_ID`), e criação dos arquivos públicos `robots.txt` e `sitemap.xml` para indexação de busca controlada.
- **Verificação no Google Search Console, Sitemap e Favicon** — Adição da meta-tag de verificação de propriedade no `index.html`, envio oficial e validação do `sitemap.xml` no console do Google e vinculação do favicon corporativo e apple-touch-icon direcionando para a marca `/logo.png` para polimento visual definitivo.
- **Redesenho Responsivo Móvel (Estilo Uber & Silk & Stone)** — Adaptação completa da Área do Cliente e Checkout para dispositivos móveis: menu fixo inferior com 5 abas (Início, Reservas, VIP, Faturas, Concierge) com suporte nativo de safe area (`bottom-nav-safe` / `top-header-safe` para notch e Dynamic Island), botões de ação e células de calendário otimizadas com área mínima de toque de 44px, e exibição do resumo do checkout como Bottom Sheet persistente, mantendo todas as regras de negócio e dados do Firestore intactos.
- **Ajustes e Correções no Fluxo Móvel e Compilação** — Resolução do loop de redirecionamento que fechava instantaneamente a tela de 'Avaliação da Residência' ao clicar em 'Solicitar Avaliação' (ajustando a lógica de rotas do `App.tsx` para não forçar o retorno à Área do Cliente quando se navega de forma explícita) e correção de tags JSX/HTML mal fechadas e erros de tipagem TypeScript em `MinhaArea.tsx`, `EspecialistaDashboard.tsx` e `types.ts` que impediam a compilação limpa do projeto.
- **Seletor de Frequência na Matriz de Preços** — Implementação de um controle segmentado premium (Sessão Avulsa vs Pacote Mensal) no topo da `PricingMatrix.tsx` para permitir que o cliente alterne dinamicamente o plano selecionado. A alteração atualiza a memória e persiste a preferência do usuário no documento de triagem no Firestore se o usuário estiver autenticado.
- **Coleta e Integração de Endereço Residencial** — Adição do campo de 'Endereço Completo' no formulário de avaliação (`ClientTriage.tsx`) e no modal de checkout (`PricingMatrix.tsx`) com preenchimento automático a partir do perfil. O endereço agora é persistido na reserva e atualizado no Firestore, substituindo o texto provisório 'Endereço no App' nas notificações de agendamento enviadas às especialistas pelo portal e pelo painel administrativo.
- **Proteção de Endereço com Liberação 24h Antes (Full-Stack)** — Implementação completa em três camadas: (1) **UI** — o Dashboard da Especialista (`EspecialistaDashboard.tsx`) oculta o endereço do cliente com ícone de cadeado e contagem regressiva até 24h antes; (2) **Notificações** — as chamadas a `notifyEmployeeAssignment` em `PricingMatrix.tsx` e `AdminPanel.tsx` foram corrigidas para enviar "Endereço liberado 24h antes do atendimento" em vez do endereço real; (3) **Cron automático** — criação do endpoint `api/send-address-reveal.ts` como Vercel Cron Job (a cada 6h) que busca reservas de amanhã com especialista atribuída, envia o endereço completo por e-mail (Resend) e WhatsApp (Meta Cloud API), e marca a reserva com `addressRevealedAt` para evitar duplicatas. A Política de Privacidade foi atualizada para refletir esta medida.
- **Suporte PWA e Service Worker Seguro** — Manifesto (`public/manifest.json`) com suporte standalone para iOS/Android. Service worker (`public/sw.js`) configurado de forma segura sem cachear dados confidenciais, autenticação ou disponibilidade (estratégia network-first com fallback offline).
- **Dashboard de Métricas Admin com SVG Dinâmico** — Removido mockups e placeholders. O painel agora computa faturamento total e número de reservas em tempo real com gráficos em SVG spline interativos. Exibe também feedbacks reais dos clientes logados.
- **Sistema de Avaliação Pós-Serviço & Nota de Especialistas** — Modais interativos em `MinhaArea.tsx` para os clientes avaliarem atendimentos passados (1 a 5 estrelas + comentário). No admin (`AdminPanel.tsx`), cada especialista exibe sua nota média real calculada sob demanda. Criada nova aba "Avaliações" no admin.
- **Centro de Alertas In-App de Deslocamento** — Centro de notificações via Firestore na Área do Cliente ("A caminho" e "Concluído") com exclusão de estimativas falsas de tempo tipo Uber para preservar o conceito luxuoso e agendado.
- **Redesenho da Lista de Espera (/lista) e Melhoria de Legibilidade** — Remoção de imagem estática com elementos falsos de interface (textos assados e ícone de menu hambúrguer cinza). Redesenho completo do fluxo móvel dividindo as seções de texto e imagem para contraste e legibilidade ideais, e otimização dos inputs, dropdowns e placeholders para digitação confortável em celulares.
- **Configuração do Hermes Agent** — Injeção do sistema operacional da marca (`SOUL.md`) com o tom de voz rioplatense, diretrizes anti-clichês, formatos de carrossel do Instagram e regras rígidas de copywriting.

### 🟡 Importante
- **Planejamento da Arquitetura do LMS (Curso de Capacitação)** — Desenho da estrutura de base de dados no Firestore (módulos, aulas, progresso, avaliações, certificados) para abrigar o curso interno de especialização das funcionárias de forma nativa na plataforma.

### 🔵 Para más adelante
1. Conectar WhatsApp Business API (API Oficial) em produção para todas as notificações transacionais e lembretes detalhados (postergado para fase comercial posterior).
2. Notificações Web Push nativas de navegador (postergado).

### 🌌 Visión a largo plazo (Objetivo a futuro)
4. Modelo de expansión tipo Uber para limpieza (abarcar más zonas y escalar operaciones).

---

## 20. Lo que NO está y NO debe agregarse sin decisión

- Sistema de chat interno entre cliente y Pame
- App nativa iOS/Android (el PWA cubre esta necesidad por ahora)
- Programa de puntos o fidelidad
- Matching automático complejo (por ahora: load balancing simple)
- Precios variables por demanda
- Rastreamento de motorista/ETA em tempo real (estilo Uber) nas notificações

---

*Última actualización: Julio 2026*
*Desarrollado con Google Antigravity 2.0*

