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

**URL en producción:** `https://www.metodopame.com`
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
Botón "Para Residências" → Avaliação da Residência → Matriz de Investimento → Pagamento → Área do Cliente

### Flujo Funcionária → `/equipe`
Formulario de candidatura independiente. Sin ninguna conexión con el flujo del cliente. Sin precios, sin datos comerciales.

**Regla crítica:** Una funcionaria NUNCA puede acceder al flujo del cliente ni ver precios. Son ecosistemas aislados.

---

## 5. Flujo del cliente detallado

### Avaliação da Residência (antes llamado "Triage" — NO usar ese nombre)
4 pasos obligatorios antes de ver cualquier precio:

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
- *(Concluído: Implementado em [PricingMatrix.tsx](file:///c:/Users/leshx/Downloads/DESARROLLO/M%C3%A9todo-Pame/src/components/PricingMatrix.tsx))*

### Campanha de Recomendação — Círculo de Excelência
Para incentivar contratos de mensalistas (*faxinas fixas*), aplica-se a seguinte regra de desconto dinâmico no Checkout:
- **Quem indica (Referente)**: Ganha **1 Faxina Completa Full Detail de cortesia** quando o amigo indicado fecha o primeiro mês de um *Pacote Mensal* (4 visitas).
- **Quem é indicado (Referido)**: Ganha **R$ 100 de desconto** no primeiro mês de contratação de qualquer *Pacote Mensal*.
  - *Lógica no Checkout*: O sistema detecta a chave `pame_referrer_uid` no localStorage (previamente capturada da URL em `App.tsx`) e subtrai R$ 100 del total en el momento de la contratación de un paquete mensual. Al confirmar la reserva, se guarda el `referrerUid` en Firestore, y se limpia el `pame_referrer_uid` del localStorage.

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
- Login con **email + contraseña generada por el sistema** (creada por Pame desde `/admin`).
- Acceso exclusivo en `/equipe`.
- **Seguridad estricta:** NUNCA pueden acceder al flujo de clientes ni ver precios. Si intentan ingresar a `/`, `/pricing` o `/minha-area`, la aplicación las redirige inmediatamente a `/equipe` de vuelta a su panel.

### Administrador (Pame + Dev)
- Acceso a `/admin` protegido para `metodopame.homedetail@gmail.com` y `contactosaintdac@gmail.com`.
- Ve todo — reservas, clientes, funcionárias, reportes financieros.

---

## 8. Área do Cliente (`/minha-area`)

Visible solo para clientes logueados. Rediseñada por completo bajo el estilo *Quiet Luxury / Silk & Stone* en 4 secciones unificadas (Abas):
- **Painel Geral (Dashboard)**: Bienvenida al cliente, estado de membresía, acceso rápido a faturas recientes, recomendaciones de servicios y acceso directo al agendamiento o pricing.
- **Minhas Reservas (Calendário)**: Calendario interactivo dinámico que cruza los datos de reservas del cliente en Firestore. Detalle del servicio seleccionado que muestra la especialista asignada (con avatar y nombre) y protocolos de lujo aplicados (Desinfección UV, Eco-Luxe, Silencioso).
- **Histórico & Faturas**: Tabla interactiva con faturas en formato PDF descargables e integración de evaluaciones con estrellas (1 a 5) que actualizan el rating directamente en Firestore en tiempo real.
- **Suporte & Concierge**: Sistema de Chat funcional con respuesta inteligente y automatizada de concierge, formulario de solicitudes especiales (Catering, Transporte, etc.) que persiste requerimientos en Firestore con modal de confirmación, y sección de preguntas frecuentes colapsables.
- **Círculo VIP (Indicações / Aba 'indique')**: Painel exclusivo de recomendação que permite copiar o link de indicação exclusivo (`https://www.metodopame.com/?ref=UID`), compartilhar via botão do WhatsApp com mensagem pré-formatada e visualizar a lista de amigos indicados com seus respectivos status (*Pendente*, *Cortesia Liberada!*, *Usufruído*), incluindo um mecanismo de mock fallback elegante caso as regras de segurança do Firestore limitem consultas cruzadas de banco.
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

**Al enviar el formulario:** Aparece pantalla de confirmación con agendamiento del **"Café Virtual com a Pame"** — así se llama la entrevista. NUNCA llamarlo "entrevista".

**En el panel admin:** Pame puede aprobar o rechazar cada candidatura.

**Filtro legal importante:** NO rechazar por edad — eso es discriminación bajo la CLT brasileña. En cambio, exigir mínimo 3 años de experiencia comprobada. Resultado práctico idéntico, sin riesgo legal.

---

## 11. Panel Admin (`/admin`)

Acceso exclusivo para Pame y el desarrollador. Funcionalidades:
- Dashboard: reservas del día, ingresos, servicios pendientes
- Gestión de pedidos: ver, editar, cancelar reservas (Modo Dios)
- Visualização da Agenda: alternância dinâmica entre Vista de Lista e Calendário Mensal com badges interativos coloridos (lilás para atribuídos, vermelho/salmão para não atribuídos).
- Agenda general: Google Calendar integrado
- Gestión de clientes: perfiles, historial, paquetes activos
- Gestión de funcionárias: fichas, disponibilidad, credenciales, historial, activar/desactivar/eliminar
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

### Variables de entorno en Vercel (configurar en dashboard):
```
RESEND_API_KEY=           ← API key de Resend
ADMIN_EMAIL=metodopame.homedetail@gmail.com  ← Email de Pame ✓ CONFIGURADO
VITE_FIREBASE_API_KEY=    ← Firebase
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_MP_PUBLIC_KEY=       ← Mercado Pago (frontend)
MP_ACCESS_TOKEN=          ← Mercado Pago (backend, NUNCA en frontend)
FIREBASE_PROJECT_ID=      ← Firebase Admin (para Cron Job)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## 13. Emails — Resend

**Plan gratuito:** 3.000 emails/mes — suficiente para el volumen inicial de Pame.

**Estado actual:** Las funciones están implementadas pero hay un error `{data: null, error: {...}}` al enviar. Causa probable: API key no cargada correctamente en Vercel O dominio remitente no verificado en Resend.

**TODO pendiente — diagnóstico:** Modificar las funciones en `/api/` para que logueen el error completo de Resend con mensaje y código exacto.

**Dominio:** Dominio propio adquirido (`www.metodopame.com`). Siguiente paso: verificarlo en Resend para que los emails salgan desde `contato@metodopame.com`.

---

## 14. Mercado Pago

**Estado actual:** Integración preparada y probada.

**TODO pendiente:** 
*(Pagos implementados y funcionando en Vercel API)*

**Flujo de pago:** El pago ocurre ANTES del servicio. La funcionaria no recibe dinero — todo va a Pame.

---

## 15. Google Calendar

**Estado actual:** **Totalmente integrado y activo**.

**Arquitectura de seguridad:** El frontend llama al endpoint seguro `/api/create-calendar-event`. Esta Vercel Function firma digitalmente las solicitudes (RS256) usando una **Service Account de Google Cloud** cargada de manera segura mediante variables de entorno en el backend (`GOOGLE_SERVICE_ACCOUNT_KEY` y `GOOGLE_CALENDAR_ID`), manteniendo las llaves privadas a salvo.
*Si las variables de entorno no están configuradas (por ejemplo, en desarrollo local), la API simula el agendamiento de forma exitosa sin interrumpir la experiencia de usuario (graceful fallback).*

**Eventos que crea el sistema:**
- En el calendario real de Pame:
  - Automático al confirmar una reserva (con todos los detalles del cliente, turno, aditivos y especialista asignada).
  - Automático al agendar un **Café Virtual** (candidata a especialista) desde la pantalla de éxito del formulario `/equipe`.
- En el calendario del cliente: botón "Adicionar à minha agenda" (link de plantilla manual para Google Calendar personal, sin requerir permisos).

---

## 16. Notificaciones

**Email (Resend):** Implementado, pendiente de diagnóstico de error.

**WhatsApp:** Para el futuro cuando el negocio esté facturando. Usar WhatsApp Business API via 360dialog. Costo: ~R$ 0,05 por mensaje de tipo Utility. Para el volumen de Pame: ~R$ 3-8/mes.

---

## 17. Decisiones de negocio tomadas — NO cambiar sin consultar a Pame

- ✅ Precios definidos (ver sección 6)
- ✅ Casa base definida: 3 quartos, 2 banheiros, 1 andar
- ✅ Recargos por tamaño definidos (ver sección 6)
- ✅ Email de Pame: `metodopame.homedetail@gmail.com`
- ✅ Matching automático con load balancing (Pame puede reasignar manualmente)
- ✅ Login con Google solo para clientes (funcionárias usan email+contraseña)
- ✅ La entrevista se llama "Café Virtual com a Pame" — NUNCA "entrevista"
- ✅ Cambios en Avaliação da Residência aplican solo a nuevas reservas, no al paquete activo
- ✅ El triage se llama "Avaliação da Residência" — NUNCA "triage" ni "triagem"

---

## 18. Pendientes activos (en orden de prioridad)

### 🟢 Completado
- ~~**Diagnosticar error de Resend** — modificar funciones en `/api/` para loguear error completo~~ (Resuelto, emails funcionando)
- ~~**Implementar precios dinámicos** — buscar `// TODO: Implementar precio dinámico` en PricingMatrix.tsx~~ (Resuelto, lógica matemática en vivo)
- ~~**Verificar el dominio `www.metodopame.com` en Resend**~~ (Resuelto)
- ~~**Café Virtual com a Pame** — agregar pantalla de confirmación al final del formulario de funcionárias con agendamiento de videollamada y grabación en base de datos.~~ (Resuelto, selector visual de slots)
- ~~**Activar Google Calendar con service account real**~~ (Resuelto, Vercel Serverless Function `/api/create-calendar-event` segura e integrada)
- ~~**Isolamento de Ecosistemas (Gating)** — separación de flujos estricta cliente vs especialista en frontend y protección de admin para múltiples correos.~~ (Resuelto)
- ~~**Sistema de evaluaciones (estrellas) del cliente sobre el servicio**~~ (Resuelto, persistencia directa en Firestore)
- ~~**Renovación Premium de la Área del Cliente (`/minha-area`)**~~ (Resuelto, integración de las 4 pantallas del Stitch con interactividad completa)
- ~~**Calendário no Painel do Administrador (Maestro de Agendas)**~~ (Resuelto, toggle dinâmico lista/calendário com controle de meses e badges inteligentes)
- **Autogestão de Disponibilidade** — Especialistas agora podem gerenciar a própria disponibilidade via interface interativa no dashboard de equipe.
- **Gating Dinâmico de Admins** — Bootstrapping automático via Firestore para validação de roles.
- **Tipagem Estrita (TypeScript) e UX** — Interfaces (`Employee`, `Booking`) padronizadas, remoção de telas e tabs não funcionais.
- **Campanha de Indicações Círculo de Excelência (Frontend & Lógica)** — Captura do parâmetro `?ref` na URL com salvamento e limpeza dinâmica de endereço (App.tsx), aplicação do desconto VIP de R$ 100 com banner explicativo no checkout (PricingMatrix.tsx), e aba de indicações ativa no portal do cliente com botão do WhatsApp e lista de indicações com fallback de mock premium (MinhaArea.tsx).
- **Redesenho Visual Premium (Diretrizes Taste Skill)** — Importação e aplicação da fonte display serifada *Cormorant Garamond* em itálico para títulos principais, injeção de textura física de papel via ruído estático em CSS, estabilização de viewports móveis (`dvh`), micro-interações táteis `active-scale` nos cliques e implementação de Skeleton Loaders animados na Área de Clientes.
- **Painel de Gestão de Indicações no Admin** — Integração e redesenho da aba de controle da campanha de recomendação no painel da Pame com painel de estatísticas neumórficas e tabela de controle detalhada (Referente, Amigo, Status e Ações).

### 🟡 Importante
*(Ninguno por el momento)*

### 🔵 Para más adelante
1. Conectar WhatsApp Business API para notificaciones de reservas y recordatorios.

### 🌌 Visión a largo plazo (Objetivo a futuro)
4. Modelo de expansión tipo Uber para limpieza (abarcar más zonas y escalar operaciones).

---

## 19. Lo que NO está y NO debe agregarse sin decisión

- Sistema de chat interno entre cliente y Pame
- App nativa iOS/Android (el PWA cubre esta necesidad por ahora)
- Programa de puntos o fidelidad
- Matching automático complejo (por ahora: load balancing simple)
- Precios variables por demanda

---

*Última actualización: Junio 2026*
*Desarrollado con Google Antigravity 2.0*
