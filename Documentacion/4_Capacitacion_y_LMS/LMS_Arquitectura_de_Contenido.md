# Documento de Arquitectura de Contenido del LMS

**Método Pame | Home Detail — Curso de Capacitación de Especialistas**

**Versión:** 1.0
**Fecha:** Julio 2026
**Para:** Brian (validación de lógica de negocio) · Antigravity (implementación técnica en Firestore + React)
**De:** GLM 5.2

---

## 0. Resumen ejecutivo

Este documento define la arquitectura de contenido del Learning Management System (LMS) que va a vivir dentro de `metodopame.com` para capacitar a las especialistas del método. Está pensado para que:

- **Brian** pueda validar la lógica de negocio antes de que se escriba una línea de código.
- **Antigravity** pueda diseñar las colecciones de Firestore, las security rules y los componentes de React directamente desde este documento.

**Decisiones ya tomadas y confirmadas:**

1. **No se crean roles nuevos en Firebase Auth.** Los roles existentes (`FOUNDER`, `CLIENT`, `CANDIDATE`, `PRE_REGISTERED`) son del flujo de clientas y quedan intactos.
2. **Las especialistas viven en `/employees`** (colección ya existente). Se extienden con dos campos nuevos: `trainingStatus` y `certificationLevel`.
3. **El progreso del curso vive como subcolección** dentro del documento de la empleada: `/employees/{employeeId}/trainingProgress/`.
4. **El certificado se genera client-side con `@react-pdf/renderer`** usando la paleta canónica de marca.
5. **Sistema de certificación por niveles** (no binario): 90%+ = "Certificada Método Pame", 70-89% = "Em Formação", <70% = no avanza. Más requisito de completar todos los módulos.
6. **Formato:** este documento es Markdown para lectura humana. El schema técnico completo está en el archivo companion `LMS_Firestore_Schema.json` para uso directo de Antigravity.

---

## 1. Estructura de cada módulo

Cada módulo es una unidad didáctica completa que contiene lecciones y termina con una evaluación. Los 15 módulos están numerados secuencialmente del 1 al 15 y no se pueden saltear.

### Campos del documento `modules/{moduleId}`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador único. Formato: `mod_01`, `mod_02`, ..., `mod_15`. |
| `number` | number | sí | Número de módulo (1-15). Usado para ordenamiento y display. |
| `title` | string | sí | Título del módulo en PT-BR. Ej: "Boas-vindas ao Método Pame". |
| `slug` | string | sí | URL-friendly. Ej: `boas-vindas-ao-metodo-pame`. |
| `description` | string | sí | Descripción corta (1-2 líneas) que se muestra en la pantalla de overview del curso. |
| `objective` | string | sí | Qué debe saber/hacer la especialista al terminar el módulo. 2-3 líneas. |
| `block` | string | sí | Bloque conceptual al que pertenece. Valores posibles: `identidad`, `postura`, `conducta`, `tecnica`, `estandar`, `operacion`. |
| `estimatedMinutes` | number | sí | Tiempo estimado de estudio (suma de lecciones + evaluación). |
| `lessons` | array of strings | sí | IDs de las lecciones que componen el módulo, en orden. Ej: `["les_01_01", "les_01_02", "les_01_03"]`. |
| `evaluationId` | string | sí | ID de la evaluación del módulo. Ej: `eva_01`. |
| `prerequisiteModuleId` | string \| null | sí | ID del módulo que tiene que estar completado antes de poder acceder a este. El módulo 1 tiene `null`. |
| `order` | number | sí | Orden de visualización. Igual que `number` pero más explícito. |
| `status` | string | sí | Estado del módulo en el sistema: `draft` (en construcción, solo visible para FOUNDER), `published` (visible para TRAINEE). |
| `createdAt` | timestamp | sí | Firestore timestamp. |
| `updatedAt` | timestamp | sí | Firestore timestamp. Se actualiza en cada modificación. |

### Ejemplo de documento `modules/mod_01`

```json
{
  "id": "mod_01",
  "number": 1,
  "title": "Boas-vindas ao Método Pame",
  "slug": "boas-vindas-ao-metodo-pame",
  "description": "Apresentação do método, da Pame e do que significa ser 'do Método'.",
  "objective": "Que a especialista entenda o que é o Método Pame, quem é Pame, e o que significa representá-lo numa residência de alto padrão.",
  "block": "identidad",
  "estimatedMinutes": 30,
  "lessons": ["les_01_01", "les_01_02", "les_01_03"],
  "evaluationId": "eva_01",
  "prerequisiteModuleId": null,
  "order": 1,
  "status": "draft",
  "createdAt": "2026-07-13T10:00:00Z",
  "updatedAt": "2026-07-13T10:00:00Z"
}
```

### Los 15 módulos (tabla resumen)

| # | title | block | lessons | min | prerequisite |
|---|---|---|---|---|---|
| 1 | Boas-vindas ao Método Pame | identidad | 3 | 30 | null |
| 2 | Quem é a nossa cliente | identidad | 4 | 45 | mod_01 |
| 3 | Postura profissional da especialista | postura | 4 | 45 | mod_02 |
| 4 | Pontualidade britânica | postura | 3 | 20 | mod_03 |
| 5 | Privacidade e sigilo absoluto | conducta | 5 | 45 | mod_04 |
| 6 | Política de zero uso pessoal | conducta | 4 | 30 | mod_05 |
| 7 | Código de postura residencial | conducta | 5 | 40 | mod_06 |
| 8 | Cuidado de mármore e pedras nobres | tecnica | 4 | 60 | mod_07 |
| 9 | Cuidado de madeira maciça e revestimentos nobres | tecnica | 4 | 45 | mod_08 |
| 10 | Cuidado de vidros e espelhos | tecnica | 4 | 45 | mod_09 |
| 11 | Cuidado de metais, grifería e inox | tecnica | 4 | 35 | mod_10 |
| 12 | Protocolo de limpeza por ambiente | tecnica | 6 | 90 | mod_11 |
| 13 | O capricho Pame | estandar | 4 | 40 | mod_12 |
| 14 | Reporte interno — como reportar a Pame | operacion | 5 | 35 | mod_13 |
| 15 | Conduta em situações difíceis | operacion | 5 | 50 | mod_14 |

**Total:** 59 lecciones, ~635 minutos (10.5 horas de contenido).

---

## 2. Estructura de cada lección

Cada lección es la unidad atómica de aprendizaje. Puede ser de tipo `reading` (texto), `video` (video grabado), o `hybrid` (texto + video). Hoy todo es `reading` porque todavía no hay cámara. Cuando se migre a video, las lecciones se actualizan a `video` o `hybrid`.

### Campos del documento `lessons/{lessonId}`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador único. Formato: `les_{mod}_{lesson}`. Ej: `les_08_02` = lección 2 del módulo 8. |
| `moduleId` | string | sí | ID del módulo al que pertenece. Ej: `mod_08`. |
| `number` | number | sí | Número de lección dentro del módulo (1-N). |
| `title` | string | sí | Título de la lección en PT-BR. |
| `type` | string | sí | Tipo de lección. Valores: `reading`, `video`, `hybrid`. |
| `content` | string | sí | Contenido en texto en PT-BR sencillo. Markdown-formatted (puede tener headers, listas, énfasis). Para tipo `video` o `hybrid`, este campo es el texto de referencia que acompaña al video. |
| `videoUrl` | string \| null | sí | URL del video cuando `type` es `video` o `hybrid`. `null` para `reading`. Hoy siempre `null`. |
| `videoDurationSeconds` | number \| null | sí | Duración del video en segundos. `null` para `reading`. |
| `estimatedMinutes` | number | sí | Tiempo estimado de lectura/visualización. Para `video`, usar `videoDurationSeconds / 60` redondeado. |
| `completionCriteria` | object | sí | Objeto que define cómo se considera esta lección "completada". Ver sección 6 para detalle. |
| `order` | number | sí | Orden dentro del módulo. |
| `status` | string | sí | `draft` o `published`. |
| `createdAt` | timestamp | sí | |
| `updatedAt` | timestamp | sí | |

### Ejemplo de documento `lessons/les_08_02`

```json
{
  "id": "les_08_02",
  "moduleId": "mod_08",
  "number": 2,
  "title": "Produtos proibidos em mármore",
  "type": "reading",
  "content": "## Por que alguns produtos são proibidos no mármore\n\nO mármore é uma pedra porosa e quimicamente sensível. Qualquer produto ácido reage com o carbonato de cálcio da pedra e cria uma marca permanente...\n\n[CONTEÚDO PENDENTE — RESPOSTA DA PAME]",
  "videoUrl": null,
  "videoDurationSeconds": null,
  "estimatedMinutes": 12,
  "completionCriteria": {
    "type": "manual_confirmation",
    "buttonLabel": "Marcar como lida",
    "requiresVideoWatch": false
  },
  "order": 2,
  "status": "draft",
  "createdAt": "2026-07-13T10:00:00Z",
  "updatedAt": "2026-07-13T10:00:00Z"
}
```

### Ejemplo de documento `lessons/les_08_02` cuando se migre a video

```json
{
  "id": "les_08_02",
  "moduleId": "mod_08",
  "number": 2,
  "title": "Produtos proibidos em mármore",
  "type": "hybrid",
  "content": "## Resumo da aula\n\nNesta aula, Pame mostra quais produtos jamais devem ser usados em mármore e por quê...\n\n## Lista rápida de produtos proibidos\n\n- Vinagre\n- Limão\n- WC net\n- Cloro\n- Esponjas verdes",
  "videoUrl": "https://storage.googleapis.com/metodo-pame-curso/mod_08/les_08_02.mp4",
  "videoDurationSeconds": 480,
  "estimatedMinutes": 10,
  "completionCriteria": {
    "type": "video_watch_threshold",
    "thresholdPercent": 90,
    "buttonLabel": null,
    "requiresVideoWatch": true
  },
  "order": 2,
  "status": "published",
  "createdAt": "2026-07-13T10:00:00Z",
  "updatedAt": "2026-09-15T14:30:00Z"
}
```

---

## 3. Estructura de cada evaluación

Cada módulo termina con una evaluación. La evaluación del curso completo (examen final) es una composición de las evaluaciones de los 15 módulos más preguntas adicionales de síntesis.

### Campos del documento `evaluations/{evaluationId}`

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador único. Formato: `eva_{mod}`. Ej: `eva_08`. |
| `moduleId` | string | sí | ID del módulo al que pertenece. |
| `title` | string | sí | Título. Ej: "Avaliação — Módulo 8: Cuidado de mármore". |
| `description` | string | sí | Instrucciones para la especialista. |
| `passingScorePercent` | number | sí | Porcentaje mínimo para aprobar esta evaluación de módulo. Default: `70`. |
| `questions` | array of objects | sí | Array de preguntas. Ver estructura de pregunta abajo. |
| `totalQuestions` | number | sí | Calculado: `questions.length`. |
| `estimatedMinutes` | number | sí | Tiempo estimado de resolución. |
| `maxAttempts` | number | sí | Máximo de intentos permitidos. Default: `2`. |
| `status` | string | sí | `draft` o `published`. |
| `createdAt` | timestamp | sí | |
| `updatedAt` | timestamp | sí | |

### Estructura de cada pregunta (dentro del array `questions`)

Cada pregunta es un objeto con esta estructura:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | ID único dentro de la evaluación. Ej: `q_08_01`. |
| `type` | string | sí | `multiple_choice`, `open_short`, o `scenario`. |
| `question` | string | sí | Enunciado en PT-BR. |
| `options` | array of strings \| null | sí | Para `multiple_choice`: array de opciones. Para `open_short` y `scenario`: `null`. |
| `correctOptionIndex` | number \| null | sí | Para `multiple_choice`: índice de la opción correcta (0-based). Para otros: `null`. |
| `expectedAnswerKeywords` | array of strings \| null | sí | Para `open_short` y `scenario`: palabras/frases clave que deben aparecer en la respuesta para considerarse correcta. Para `multiple_choice`: `null`. |
| `feedback` | string | sí | Feedback que se muestra después de responder (correcto o incorrecto). |
| `points` | number | sí | Puntos que vale esta pregunta. Default: `1`. |
| `order` | number | sí | Orden dentro de la evaluación. |

### Ejemplo de pregunta multiple_choice

```json
{
  "id": "q_08_01",
  "type": "multiple_choice",
  "question": "Qual destes produtos é PROIBIDO em mármore?",
  "options": [
    "Sabão neutro diluído em água",
    "Vinagre",
    "Bicarbonato de sódio",
    "Água morna"
  ],
  "correctOptionIndex": 1,
  "expectedAnswerKeywords": null,
  "feedback": "O vinagre é ácido e reage com o carbonato de cálcio do mármore, criando marcas permanentes que aparecem semanas depois.",
  "points": 1,
  "order": 1
}
```

### Ejemplo de pregunta open_short

```json
{
  "id": "q_05_03",
  "type": "open_short",
  "question": "Explique com suas palavras por que a política de zero uso pessoal existe.",
  "options": null,
  "correctOptionIndex": null,
  "expectedAnswerKeywords": ["confiança", "privacidade", "respeito"],
  "feedback": "A política existe porque qualquer uso de pertences da cliente quebra a confiança de forma invisível e permanente.",
  "points": 1,
  "order": 3
}
```

### Ejemplo de pregunta scenario

```json
{
  "id": "q_15_02",
  "type": "scenario",
  "question": "Você chega na casa da cliente e a mesada de mármore tem uma mancha de vinho tinto da noite anterior. O que você faz, passo a passo?",
  "options": null,
  "correctOptionIndex": null,
  "expectedAnswerKeywords": ["bicarbonato", "água", "24 horas", "não esfregar", "avisar Pame"],
  "feedback": "O protocolo correto é: aplicar pasta de bicarbonato + água sobre a mancha, deixar agir 24 horas, não esfregar, e avisar a Pame antes de começar qualquer tratamento.",
  "points": 2,
  "order": 8
}
```

### Composición del examen final

El examen final (que se rinde después de completar los 15 módulos) se construye dinámicamente en runtime tomando:

- Una muestra aleatoria de preguntas de cada `evaluation` de módulo (proporcional al peso del bloque).
- Preguntas adicionales de síntesis que están en una colección `final_exam_questions`.

Esto se detalla en la sección 7.

---

## 4. Estructura del progreso de la especialista

El progreso de cada especialista vive como subcolección dentro de su documento de empleado: `/employees/{employeeId}/trainingProgress/`.

### Campos del documento `trainingProgress/{progressId}`

Donde `progressId` = `{employeeId}_{moduleId}` (ej: `emp_001_mod_08`).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | Compuesto: `{employeeId}_{moduleId}`. |
| `employeeId` | string | sí | Referencia al documento de la empleada. |
| `moduleId` | string | sí | Referencia al módulo. |
| `moduleStatus` | string | sí | Estado del módulo para esta empleada: `not_started`, `in_progress`, `completed`, `failed`. |
| `lessonsProgress` | array of objects | sí | Array con el progreso de cada lección. Ver estructura abajo. |
| `evaluationAttempts` | array of objects | sí | Array con el historial de intentos de evaluación. |
| `bestScorePercent` | number \| null | sí | Mejor porcentaje obtenido en la evaluación. `null` si no rindió todavía. |
| `passed` | boolean | sí | `true` si aprobó (≥70%). |
| `startedAt` | timestamp \| null | sí | Cuando empezó el módulo. `null` si no empezó. |
| `completedAt` | timestamp \| null | sí | Cuando completó (pasó la evaluación). `null` si no completó. |
| `lastActivityAt` | timestamp | sí | Última vez que interactuó con el módulo. |

### Estructura de cada item en `lessonsProgress`

| Campo | Tipo | Descripción |
|---|---|---|
| `lessonId` | string | ID de la lección. |
| `status` | string | `not_started`, `in_progress`, `completed`. |
| `videoProgressPercent` | number \| null | Si la lección es video: porcentaje visto (0-100). `null` para lectura. |
| `videoWatchTimeSeconds` | number \| null | Tiempo total de visualización. Para analytics. |
| `completedAt` | timestamp \| null | Cuando se marcó como completada. |
| `lastVisitedAt` | timestamp \| null | Última vez que la abrió. |

### Estructura de cada item en `evaluationAttempts`

| Campo | Tipo | Descripción |
|---|---|---|
| `attemptNumber` | number | 1, 2, etc. |
| `startedAt` | timestamp | |
| `completedAt` | timestamp \| null | `null` si está en progreso. |
| `scorePercent` | number \| null | Resultado del intento. `null` si no terminó. |
| `answers` | array of objects | Cada respuesta: `{ questionId, answer, correct }`. |
| `passed` | boolean | `true` si este intento fue aprobado. |

### Ejemplo de documento `trainingProgress/emp_001_mod_08`

```json
{
  "id": "emp_001_mod_08",
  "employeeId": "emp_001",
  "moduleId": "mod_08",
  "moduleStatus": "in_progress",
  "lessonsProgress": [
    {
      "lessonId": "les_08_01",
      "status": "completed",
      "videoProgressPercent": null,
      "videoWatchTimeSeconds": null,
      "completedAt": "2026-07-13T11:00:00Z",
      "lastVisitedAt": "2026-07-13T11:00:00Z"
    },
    {
      "lessonId": "les_08_02",
      "status": "in_progress",
      "videoProgressPercent": null,
      "videoWatchTimeSeconds": null,
      "completedAt": null,
      "lastVisitedAt": "2026-07-13T11:15:00Z"
    },
    {
      "lessonId": "les_08_03",
      "status": "not_started",
      "videoProgressPercent": null,
      "videoWatchTimeSeconds": null,
      "completedAt": null,
      "lastVisitedAt": null
    },
    {
      "lessonId": "les_08_04",
      "status": "not_started",
      "videoProgressPercent": null,
      "videoWatchTimeSeconds": null,
      "completedAt": null,
      "lastVisitedAt": null
    }
  ],
  "evaluationAttempts": [],
  "bestScorePercent": null,
  "passed": false,
  "startedAt": "2026-07-13T11:00:00Z",
  "completedAt": null,
  "lastActivityAt": "2026-07-13T11:15:00Z"
}
```

### Extensión del documento `/employees/{employeeId}`

A los campos ya existentes en `/employees/{employeeId}` se agregan:

| Campo nuevo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `trainingStatus` | string | sí | Estado general del curso. Valores: `not_started`, `in_progress`, `completed`, `certified`. |
| `certificationLevel` | string \| null | sí | Nivel de certificación. Valores: `Certificada Método Pame`, `Em Formação`, `null` (sin certificar todavía). |
| `certificationDate` | timestamp \| null | sí | Fecha de emisión del certificado. `null` si no certificada. |
| `certificationCode` | string \| null | sí | Código único de verificación del certificado. Formato: `MP-CERT-{year}-{employeeId}-{random6}`. Ej: `MP-CERT-2026-emp_001-A4B7C9`. |
| `trainingStartedAt` | timestamp \| null | sí | Cuando empezó el curso. `null` si no empezó. |
| `trainingCompletedAt` | timestamp \| null | sí | Cuando completó los 15 módulos. `null` si no completó. |
| `finalExamScore` | number \| null | sí | Porcentaje del examen final. `null` si no rindió. |
| `finalExamAttempts` | array of objects | sí | Historial de intentos del examen final. |

---

## 5. Estructura de certificación

### Campos del documento `certifications/{certificationId}`

Donde `certificationId` = el `certificationCode` generado.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | string | sí | = `certificationCode`. |
| `employeeId` | string | sí | Referencia a la empleada certificada. |
| `employeeName` | string | sí | Nombre de la empleada (denormalizado para el certificado). |
| `level` | string | sí | `Certificada Método Pame` o `Em Formação`. |
| `finalExamScorePercent` | number | sí | Porcentaje del examen final. |
| `modulesCompleted` | number | sí | Cantidad de módulos completados (debe ser 15). |
| `issuedAt` | timestamp | sí | Fecha de emisión. |
| `issuedBy` | string | sí | ID de Pame (quien firma). Default: `pame`. |
| `certificateCode` | string | sí | Código único. |
| `valid` | boolean | sí | `true` si el certificado está vigente. `false` si fue revocado. |
| `revokedAt` | timestamp \| null | sí | Si fue revocado, cuándo. |
| `revokedReason` | string \| null | sí | Si fue revocado, por qué. |

### Niveles de certificación

| Nivel | Condición | Status en `/employees` | Permiso |
|---|---|---|---|
| **Certificada Método Pame** | Examen final ≥90% Y los 15 módulos completados | `trainingStatus: 'certified'`, `certificationLevel: 'Certificada Método Pame'` | Puede ser asignada sola a residencias de alto estándar. Aparece en la plataforma con status "Certificada". |
| **Em Formação** | Examen final 70-89% Y los 15 módulos completados | `trainingStatus: 'completed'`, `certificationLevel: 'Em Formação'` | Puede hacer pasantía con especialista senior. NO puede ser asignada sola. Debe volver a rendir para alcanzar 90%+. |
| **No certificada** | Examen final <70% O módulos incompletos | `trainingStatus: 'in_progress'` (sigue estudiando) | No puede ser asignada a ninguna residencia. |

### Generación del certificado

El certificado se genera client-side con `@react-pdf/renderer` cuando la empleada aprueba el examen final. El PDF se descarga automáticamente y el registro queda en Firestore.

**Especificaciones visuales canónicas (del brand-book):**

- **Fondo:** Violeta `#561668` (full bleed).
- **Acentos:** Dorado `#C9A84C` (líneas, bordes, código de verificación).
- **Tipografía:** Manrope (sans-serif), blanco. Sin Cormorant Garamond.
- **Logo:** Versión blanca del logo Método Pame.
- **Texto del certificado (PT-BR):**
  - Header: "CERTIFICADO"
  - Subtítulo: "Método Pame | Home Detail"
  - Cuerpo: "Certificamos que [NOME DA ESPECIALISTA] completou o curso de formação do Método Pame | Home Detail, com aproveitamento de [SCORE]% no exame final, e está habilitada a atuar como especialista certificada do método."
  - Footer: "Emitido em [DATA]. Código de verificação: [CERTIFICATION_CODE]."
  - Firma: "Pame — Fundadora, Método Pame"
- **Código de verificación:** visible en el PDF y verificable en `metodopame.com/verificar-certificado/{certificateCode}`.

---

## 6. Lógica de bloqueo de avance (DETALLADO POR TIPO DE LECCIÓN)

Esta es la sección que Antigravity pidió específicamente. Define el criterio exacto de completitud por tipo de lección, porque cambia la complejidad de implementación.

### Tipos de lección y su criterio de completitud

#### Tipo `reading` (texto puro)

**Criterio de completitud:** Confirmación manual vía botón.

**UX:**
- La especialista lee el contenido.
- Al final de la lección hay un botón grande: "Marcar como lida".
- Al hacer click, se actualiza `lessonsProgress[lessonId].status = 'completed'` y `completedAt = now()`.
- El botón desaparece y se reemplaza por un check verde con texto "Lida".
- Se puede desmarcar con un link pequeño "desmarcar" (por si marcó por error), lo que resetea el status.

**Implementación técnica:**
- No requiere tracking de video.
- No requiere evento de scroll ni tiempo mínimo en página.
- Solo un botón que dispara una actualización en Firestore.
- **Complejidad: baja.** Un solo write en Firestore por lección completada.

**Campo relevante en `completionCriteria`:**
```json
{
  "type": "manual_confirmation",
  "buttonLabel": "Marcar como lida",
  "requiresVideoWatch": false
}
```

#### Tipo `video` (video puro, sin texto de referencia)

**Criterio de completitud:** 90% del video visto.

**UX:**
- La especialista ve el video.
- Hay una barra de progreso visual del video (player estándar).
- Cuando el video llega al 90%, el botón "Próxima lição" se desbloquea (antes está gris con candado).
- Si la especialista sale de la página antes del 90%, el progreso se guarda. Al volver, retoma desde donde dejó.
- No hay botón "Marcar como vista" — la completitud es automática al llegar al 90%.

**Implementación técnica:**
- Requiere un player de video que emita eventos de progreso (`onTimeUpdate` o similar).
- Cada N segundos (sugerencia: cada 5 segundos), se actualiza `videoProgressPercent` y `videoWatchTimeSeconds` en Firestore.
- Cuando `videoProgressPercent >= 90`, se marca automáticamente la lección como `completed`.
- **Complejidad: media.** Requiere tracking de eventos de video + writes periódicos en Firestore (pensar en debounce para no quemar writes).

**Campo relevante en `completionCriteria`:**
```json
{
  "type": "video_watch_threshold",
  "thresholdPercent": 90,
  "buttonLabel": null,
  "requiresVideoWatch": true
}
```

#### Tipo `hybrid` (video + texto de referencia)

**Criterio de completitud:** 90% del video visto. El texto es referencia opcional.

**UX:**
- El video está arriba, el texto de referencia está abajo (en un accordion colapsable para no saturar).
- El criterio de completitud es el mismo que `video`: 90% del video visto.
- El texto no tiene botón de "Marcar como lida" — es referencia.
- Si la especialista quiere consultar el texto después, puede volver a la lección y abrir el accordion.

**Implementación técnica:**
- Igual que `video`, pero el componente React renderiza también el contenido textual.
- **Complejidad: media.** Igual que `video`.

**Campo relevante en `completionCriteria`:**
```json
{
  "type": "video_watch_threshold",
  "thresholdPercent": 90,
  "buttonLabel": null,
  "requiresVideoWatch": true
}
```

### Reglas de bloqueo entre lecciones (dentro de un módulo)

- La lección N+1 solo se desbloquea cuando la lección N está `completed`.
- Excepción: la primera lección del módulo siempre está desbloqueada (cuando el módulo está desbloqueado).
- Si la especialista quiere revisar una lección ya completada, puede — pero no afecta el progreso.

### Reglas de bloqueo entre módulos

- El módulo N+1 solo se desbloquea cuando:
  1. Todas las lecciones del módulo N están `completed`.
  2. La evaluación del módulo N está `passed` (≥70%).
- El módulo 1 siempre está desbloqueado (cuando la empleada tiene `trainingStatus: 'not_started'` o `'in_progress'`).
- **No se puede saltear módulos.** Esta es regla de oro del sistema de certificación.

### Reglas para rendir el examen final

- Solo puede rendir el examen final cuando los 15 módulos están `passed`.
- El examen final se compone dinámicamente (ver sección 7).
- Máximo de intentos: 2 por mes.
- Después de un intento fallido, hay que esperar 24 horas para volver a rendir (cooldown).
- El resultado del examen final determina el `certificationLevel`:
  - ≥90% → `Certificada Método Pame`
  - 70-89% → `Em Formação`
  - <70% → no avanza, puede rendir de nuevo después del cooldown.

---

## 7. Composición del examen final

El examen final no es una evaluación más en Firestore — se construye dinámicamente en runtime.

### Lógica de composición

El examen final tiene aproximadamente 40-50 preguntas totales, distribuidas así:

| Bloque | Preguntas | Origen |
|---|---|---|
| Identidad (módulos 1-2) | 4 | Muestra aleatoria de las evaluaciones de módulos 1 y 2. |
| Postura (módulos 3-4) | 4 | Muestra aleatoria de las evaluaciones de módulos 3 y 4. |
| Conducta (módulos 5-7) | 6 | Muestra aleatoria de las evaluaciones de módulos 5, 6 y 7. |
| Técnica (módulos 8-12) | 15 | Muestra aleatoria de las evaluaciones de módulos 8-12 (mayor peso porque es el corazón del método). |
| Estándar (módulo 13) | 3 | Muestra aleatoria de la evaluación del módulo 13. |
| Operación (módulos 14-15) | 5 | Muestra aleatoria de las evaluaciones de módulos 14 y 15. |
| Síntesis (cross-module) | 3 | Preguntas adicionales que solo existen en el examen final. Están en `final_exam_questions/`. |

Total: 40 preguntas.

### Tipos de pregunta en el examen final

Distribución por tipo (igual que en las evaluaciones de módulo):

- 40% multiple choice (16 preguntas)
- 30% open_short (12 preguntas)
- 30% scenario (12 preguntas)

### Colección `final_exam_questions/{questionId}`

Esta colección tiene las preguntas adicionales de síntesis que solo aparecen en el examen final. Mismos campos que cualquier pregunta, pero con `moduleId: 'final_exam'`.

### Documento `final_exam_attempts/{attemptId}`

Cada intento del examen final se registra acá.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID único del intento. |
| `employeeId` | string | Referencia a la empleada. |
| `startedAt` | timestamp | |
| `completedAt` | timestamp \| null | |
| `questions` | array of objects | Las 40 preguntas que se le presentaron (snapshot del examen). |
| `answers` | array of objects | Las respuestas de la empleada. |
| `scorePercent` | number \| null | |
| `passed` | boolean | |
| `certificationLevel` | string \| null | Si pasó: `Certificada Método Pame` o `Em Formação`. |

---

## 8. Flujo de estados de la especialista

Desde que ingresa al sistema como candidata hasta que recibe el certificado.

### Estados de `/employees/{employeeId}.status` (campo ya existente)

| Estado | Significado |
|---|---|
| `pending` | Candidata nueva, pendiente de aprobación de Pame (CPF, antecedentes, entrevista). |
| `active` | Aprobada por Pame, puede empezar el curso. |
| `inactive` | Desvinculada del método (no se borra, se archiva). |

### Estados de `/employees/{employeeId}.trainingStatus` (campo nuevo)

| Estado | Significado | Acción habilitada |
|---|---|---|
| `not_started` | `active` pero todavía no entró al curso. | Puede entrar al módulo 1. |
| `in_progress` | Empezó el curso, no terminó. | Puede seguir donde dejó. |
| `completed` | Terminó los 15 módulos y rindió el examen final con 70-89%. | "Em Formação". Puede hacer pasantía. |
| `certified` | Rindió el examen final con ≥90%. | "Certificada Método Pame". Puede ser asignada sola. |

### Flujo completo

```
Candidata nueva
    ↓
[CPF + antecedentes + referencias + entrevista con Pame]
    ↓
Pame aprueba → /employees/{id}.status = 'active'
                /employees/{id}.trainingStatus = 'not_started'
    ↓
Especialista entra al curso (módulo 1 desbloqueado)
    ↓
/employees/{id}.trainingStatus = 'in_progress'
    ↓
[Recorre los 15 módulos en orden, sin saltear]
    ↓
[Completa módulo 1] → [desbloquea módulo 2] → ... → [Completa módulo 15]
    ↓
[Desbloquea examen final]
    ↓
[Rinde examen final]
    ↓
    ├── ≥90% → /employees/{id}.trainingStatus = 'certified'
    │          /employees/{id}.certificationLevel = 'Certificada Método Pame'
    │          /employees/{id}.certificationDate = now()
    │          /employees/{id}.certificationCode = 'MP-CERT-2026-emp_001-A4B7C9'
    │          → Genera certificado PDF client-side
    │          → Especialista puede ser asignada sola a residencias
    │
    ├── 70-89% → /employees/{id}.trainingStatus = 'completed'
    │           /employees/{id}.certificationLevel = 'Em Formação'
    │           → Especialista puede hacer pasantía con senior
    │           → Puede volver a rendir después de 30 días
    │
    └── <70% → No cambia trainingStatus (sigue 'in_progress')
              → Puede volver a rendir después de 24 horas (cooldown)
              → Si en el 2do intento no llega a 70%, Pame evalúa si continúa
```

---

## 9. Reglas de seguridad de Firestore (sugerencias para Antigravity)

Estas son las reglas básicas que deberían aplicarse a las colecciones nuevas. Antigravity puede refinarlas.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Modules, lessons, evaluations: solo lectura para empleadas activas, escritura solo para FOUNDER
    match /modules/{moduleId} {
      allow read: if isEmployeeActive() || isFounder();
      allow write: if isFounder();
    }
    match /lessons/{lessonId} {
      allow read: if isEmployeeActive() || isFounder();
      allow write: if isFounder();
    }
    match /evaluations/{evaluationId} {
      allow read: if isEmployeeActive() || isFounder();
      allow write: if isFounder();
    }

    // Progreso de capacitación: solo la propia empleada puede leer/escribir su progreso
    // FOUNDER puede leer todos (para monitoreo)
    match /employees/{employeeId}/trainingProgress/{progressId} {
      allow read: if isOwner(employeeId) || isFounder();
      allow write: if isOwner(employeeId) || isFounder();
    }

    // Certificaciones: lectura pública (para verificación de certificado), escritura solo sistema/FOUNDER
    match /certifications/{certificationId} {
      allow read: if true; // público, para verificación
      allow write: if isFounder();
    }

    // Preguntas del examen final: lectura solo para empleadas activas cuando rinden
    match /final_exam_questions/{questionId} {
      allow read: if isEmployeeActive() || isFounder();
      allow write: if isFounder();
    }

    // Helpers
    function isFounder() {
      return request.auth != null && request.auth.token.role == 'FOUNDER';
    }
    function isEmployeeActive() {
      return request.auth != null && exists(/databases/{database}/documents/employees/$(request.auth.uid))
        && get(/databases/{database}/documents/employees/$(request.auth.uid)).data.status == 'active';
    }
    function isOwner(employeeId) {
      return request.auth != null && request.auth.uid == employeeId;
    }
  }
}
```

---

## 10. Pantallas sugeridas (para que Brian valide UX)

Esta es una propuesta de las pantallas mínimas necesarias. Antigravity la puede refinar con los patrones ya existentes en el sitio.

### 10.1 Pantalla de overview del curso (`/capacitacao`)

- **Visible para:** empleadas con `status: 'active'`.
- **Contenido:**
  - Header con título "Curso de Formação — Método Pame" + progreso general (barra con "Módulo 4 de 15").
  - Lista de los 15 módulos en cards verticales. Cada card muestra: número, título, bloque, duración estimada, status de la empleada (`not_started` / `in_progress` / `completed` / `passed`).
  - Los módulos bloqueados aparecen en gris con icono de candado.
  - El módulo actual (el próximo a hacer) aparece destacado con borde dorado.

### 10.2 Pantalla de módulo (`/capacitacao/modulo/{moduleSlug}`)

- **Visible para:** empleadas con ese módulo desbloqueado.
- **Contenido:**
  - Header con número y título del módulo, objetivo, duración estimada, progreso dentro del módulo (barra con "Lição 2 de 4").
  - Lista de lecciones en orden. Cada una con: número, título, tipo (reading/video/hybrid), status.
  - Botón "Começar avaliação" al final, deshabilitado hasta que todas las lecciones estén `completed`.
  - Si ya rindió la evaluación, muestra el score y botón "Refazer avaliação" si le quedan intentos.

### 10.3 Pantalla de lección (`/capacitacao/modulo/{moduleSlug}/licao/{lessonNumber}`)

- **Contenido:**
  - Header con número y título de la lección, tipo de lección.
  - Cuerpo:
    - Si `reading`: contenido en Markdown renderizado. Al final, botón "Marcar como lida".
    - Si `video`: player de video. Barra de progreso visual.
    - Si `hybrid`: player de video arriba + accordion con texto de referencia abajo.
  - Footer con navegación: "Lição anterior" (siempre habilitado para volver) y "Próxima lição" (habilitado solo si la lección actual está completada; si no, gris con candado).

### 10.4 Pantalla de evaluación (`/capacitacao/modulo/{moduleSlug}/avaliacao`)

- **Contenido:**
  - Header con título "Avaliação — Módulo {N}" + instrucciones.
  - Una pregunta por pantalla, con botón "Próxima" (no se puede volver a preguntas anteriores — evita copiar respuestas).
  - Para `multiple_choice`: opciones con radio buttons.
  - Para `open_short`: textarea con límite de 500 caracteres.
  - Para `scenario`: textarea más grande con límite de 1000 caracteres.
  - Al final: pantalla de resultado con score, nível, y feedback por pregunta.
  - Botón "Voltar ao módulo" si aprobó, o "Refazer avaliação" si reprobó y le quedan intentos.

### 10.5 Pantalla de examen final (`/capacitacao/exame-final`)

- Solo se accede si los 15 módulos están `passed`.
- Misma UX que evaluación de módulo, pero con 40 preguntas y duración de 90-120 minutos.
- Al final: pantalla de resultado con nivel de certificación.

### 10.6 Pantalla de certificado (`/capacitacao/certificado`)

- Solo se accede si `certificationLevel` no es `null`.
- Muestra el certificado generado (con `@react-pdf/renderer`).
- Botón "Baixar PDF" para descargar.
- Muestra el código de verificación con link a la URL pública de verificación.

### 10.7 Pantalla pública de verificación (`/verificar-certificado/{certificateCode}`)

- Pública (sin auth).
- Input para ingresar un código de certificado.
- Muestra: nombre de la especialista, nivel, fecha de emisión, estado (vigente/revocado).
- Esto permite que una clienta (o cualquier persona) verifique que un certificado presentado por una especialista es real.

---

## 11. Próximos pasos propuestos

1. **Brian valida este documento** — lee la lógica de negocio, ajusta lo que no coincida con su visión.
2. **Antigravity toma el JSON companion** (`LMS_Firestore_Schema.json`) y diseña las collections reales en Firestore, las security rules, y los componentes de React.
3. **Brian arma la estructura vacía en el site** — los 15 módulos con placeholders `[CONTEÚDO PENDENTE — RESPOSTA DA PAME]`, sin contenido real todavía.
4. **Pame responde el cuestionario** (PDF 2 que ya entregué).
5. **Brian rellena los placeholders** con las respuestas de Pame, pasa por IA para pulir el PT-BR, Pame aprueba.
6. **Primera candidata piloto** toma el curso. Se itera.

---

## 12. Apéndice — Convenciones de naming

- **IDs de módulo:** `mod_01` a `mod_15` (siempre 2 dígitos para ordenamiento lexicográfico).
- **IDs de lección:** `les_{mod}_{lesson}` (ej: `les_08_02`).
- **IDs de evaluación:** `eva_{mod}` (ej: `eva_08`).
- **IDs de pregunta:** `q_{mod}_{n}` (ej: `q_08_01`).
- **IDs de progreso:** `{employeeId}_{moduleId}` (ej: `emp_001_mod_08`).
- **Códigos de certificado:** `MP-CERT-{year}-{employeeId}-{random6}` (ej: `MP-CERT-2026-emp_001-A4B7C9`).
- **Slugs:** kebab-case PT-BR (ej: `cuidado-de-marmore-e-pedras-nobres`).
- **Timestamps:** ISO 8601 UTC en JSON, Firestore timestamps en la base.
