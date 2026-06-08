# PROJETO.md — Memoria Permanente del Proyecto
## MÉTODO PAME | Home Detail

> Este archivo es la fuente de verdad del proyecto. Leelo completo antes de tocar cualquier cosa.

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

---

## 3. Identidad visual

- **Estética:** Quiet Luxury
- **Color principal:** Morado `#561668`
- **Fondo:** Blanco `#ffffff`
- **Tipografía:** Sans-serif limpia
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

**TODO pendiente:** Implementar esta lógica en `PricingMatrix.tsx` donde se calcula el precio. Hay un comentario `// TODO: Implementar precio dinámico por dimensiones de residencia` marcando el lugar exacto.

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

### Clientes
- Login con **Google Auth (Gmail)** — un clic, sin contraseña
- Opcional — pueden contratar sin registrarse (guest checkout)
- Al loguearse sin reservas previas → van a la Avaliação da Residência
- Al loguearse con reservas → van directo a Minha Área
- **Nunca acceden a `/equipe`**

### Funcionárias
- Login con **email + contraseña generada por el sistema**
- Las credenciales las crea Pame desde el panel admin
- Acceso solo en `/equipe`
- **Nunca ven precios ni datos comerciales**
- **Nunca acceden al flujo del cliente**

### Administrador (Pame + Dev)
- Acceso a `/admin`
- Ve todo — reservas, clientes, funcionárias, reportes financieros

---

## 8. Área do Cliente (`/minha-area`)

Visible solo para clientes logueados. Contiene:
- Próximo serviço agendado (con foto y nombre de la especialista)
- Historial completo de servicios
- Status del paquete activo (mensal/avulso, sesiones restantes)
- Datos de la residencia (editables — cambios aplican solo a nuevas reservas)
- Botón de acceso directo a la Matriz de Investimento
- Botón "Adicionar à minha agenda" → Google Calendar personal del cliente (Opción A: link manual, sin permisos extra)

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
- Designación de funcionárias: matching manual o revisar asignación automática
- Agenda general: Google Calendar integrado
- Gestión de clientes: perfiles, historial, paquetes activos
- Gestión de funcionárias: fichas, disponibilidad, credenciales, historial, activar/desactivar/eliminar
- Revisión de candidaturas: aprobar o rechazar con opción de agendar Café Virtual
- Reportes financieros: ingresos por mes, servicios por tipo, add-ons más contratados

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

**Estado actual:** Integrado como MOCK con placeholders.

**TODO futuro:** Activar con service account real.

**Importante seguridad:** La service account NO puede estar en el frontend. Mover a Vercel Functions cuando se active.

**Eventos que crea el sistema:**
- En el calendario de Pame: automático al confirmar reserva (con todos los detalles)
- En el calendario del cliente: botón "Adicionar à minha agenda" (Opción A — link manual, sin permisos extra)

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

### 🔴 Inmediato
1. **Diagnosticar error de Resend** — modificar funciones en `/api/` para loguear error completo
2. **Implementar precios dinámicos** — buscar `// TODO: Implementar precio dinámico` en PricingMatrix.tsx

### 🟡 Importante
3. **Café Virtual com a Pame** — agregar pantalla de confirmación al final del formulario de funcionárias con agendamiento de videollamada. En panel admin: botón para aprobar/rechazar candidatura.

### 🟢 Para más adelante
4. Verificar el dominio `www.metodopame.com` en Resend para mejorar la entrega de correos.
5. Activar Google Calendar con service account real
6. Sistema de evaluaciones del cliente sobre el servicio
7. Que las funcionárias gestionen su propia disponibilidad desde `/equipe`
8. WhatsApp Business API para notificaciones
9. Modelo de expansión tipo Uber para limpieza (visión a futuro con Pame)

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
