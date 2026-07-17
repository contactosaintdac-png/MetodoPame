---
name: human-touch
description: >
  Skill anti-AI para diseño web, código, copy y arquitectura. Úsala SIEMPRE que el
  usuario mencione "anti-AI", "que no parezca IA", "humanizar", "que se sienta
  artesanal", "que no parezca generado", "slop", "vibe-coded", "default look",
  "generic SaaS look", o pida explícitamente diferenciación visual frente a
  plantillas AI. Úsala TAMBIÉN de forma preventiva al generar cualquier landing
  page, portfolio, SaaS frontend, o rediseño web donde la originalidad sea
  prioritaria — incluso si el usuario no lo pide explícitamente, porque los
  defaults de los generadores (Inter, gradientes púrpura, shadcn sin customizar,
  copy con "delve" y "seamless") son tan omnipresentes que es mejor aplicar
  esta skill por defecto. Complementa /design-taste-frontend añadiendo la capa
  de detección y rechazo activo de patrones AI. Funciona en dos modos:
  (1) AUDITOR — revisa código/design existente y marca los anti-patrones AI
  detectados; (2) GENERADOR — aplica reglas anti-AI al crear nuevo código.
  Detecta automáticamente el modo según si hay código previo o es proyecto nuevo.
---

# Human-Touch — Skill anti-AI para web

> "AI slop is what happens when speed without intention produces mediocrity at
> scale. The antidote is not avoiding AI — it is refusing to ship AI defaults."
> — Paráfrasis de 925Studios, 2026

## Cuándo usar esta skill

Activa `human-touch` en cualquiera de estas situaciones:

- El usuario dice frases como "que no se note que es IA", "humanízalo",
  "que no parezca generado", "que se sienta artesanal / hecho a mano",
  "evita el look SaaS genérico", "no quiero que parezca vibe-coded".
- Vas a generar una landing page, portfolio, o frontend SaaS desde cero.
- Vas a rediseñar o auditar código frontend existente.
- El usuario menciona "AI slop", "slop detection", "anti-AI design".
- Tras invocar `/design-taste-frontend` o `/high-end-visual-design` para
  añadir la capa de rechazo activo de defaults AI.

## Filosofía

Los modelos LLM y los generadores de UI (v0, Bolt, Lovable, Framer AI,
Cursor) tienden estadísticamente al "centro" de su training data. Ese
centro — Inter, gradientes púrpura-azul, dark mode con texto gris,
feature cards idénticas, copy con "delve" y "seamless" — es lo que la
comunidad llama **AI slop**. No es malo por sí mismo; es malo porque
**es indistinguible entre proyectos**, lo que mata la memorabilidad
de marca.

Estudios citados en foros (julio 2026):
- **Adrian Krebs (Show HN, 1.590 landing pages)**: 22 % eran "heavy
  slop" (4+ patrones), 32 % "mild slop", solo 46 % "clean".
- **Second Talent (2026)**: 40-62 % del código AI contiene flaws de
  seguridad o diseño.
- **Neil Patel (2025)**: el contenido humano supera al AI en 94.12 %
  de los casos en engagement/conversión.

Tu trabajo con esta skill es **forzar decisiones explícitas** donde los
generadores usarían defaults. No se trata de evitar IA; se trata de
**no aceptar defaults sin opinión**.

## Modos de operación

### Modo AUDITOR (cuando hay código/HTML/CSS existente)

1. Lee el archivo(s) del usuario.
2. Carga `references/impeccable-46-rules.md` y `references/krebs-16-patterns.md`.
3. Recorre el código contra las dos listas de patrones.
4. Genera un reporte con este formato:

```
## Human-Touch Audit Report

### Slop Score: X/46 patrones detectados (Y/16 de Krebs)

### Hallazgos críticos (deben corregirse antes de publicar)
- [Línea/Selector] Patrón detectado · Por qué es un tell · Fix sugerido

### Hallazgos menores (mejoran diferenciación)
- ...

### Decisiones de diseño que SÍ son intencionales (no tocar)
- ...
```

5. **No reescribas el código automáticamente en modo auditor.**
   El usuario debe decidir qué tocar. Solo marcas y sugieres.

### Modo GENERADOR (proyecto nuevo o el usuario pide rehacer)

1. Antes de escribir nada, determina el contexto del proyecto leyendo
   `references/context-routing.md`. Elige UNA estética:
   - **Editorial/Revista** — portfolios, medios, fundadores, premium B2B
   - **Brutalista/Suizo** — SaaS técnico, developer tools, infra
   - **Hand-crafted** — consumer, lifestyle, marcas con personalidad fuerte
2. Carga `references/anti-ai-snippets.md` para los patrones de código.
3. Aplica las **Hard Rules** de abajo sin excepción.
4. Aplica los **Principios contextuales** según la estética elegida.
5. Al terminar, auto-audita con `references/impeccable-46-rules.md`.
   Si el slop score > 3, itera antes de entregar.

---

## Hard Rules (no negociables)

Estas son las reglas que la comunidad de foros (Reddit, HN, Impeccable,
estudio Krebs) identifica como los tells más fiables. Aplicar siempre.

### Tipografía

1. **No uses Inter como única tipografía.** Si vas a usar Inter, emparéjala
   con una display font con personalidad (Tiempos, Freight, Bricolage
   Grotesque, JetBrains Mono). Razón: Inter aparece en el 100 % de los
  generadores AI como default; usarla sola es el tell nº 1 citado en
  todos los foros.

2. **No uses Instrument Serif en itálica como "accent word" dentro de un
   título en Inter.** Es el hero universal de startup AI (2025-2026).
   Si quieres una serif, úsala para todo el título, en romana.

3. **Crea jerarquía tipográfica real.** Ratio mínimo 1.25 entre escalones
   de tamaño. Si título, subtítulo y cuerpo tienen tamaños casi idénticos,
   la página se lee "plana" — tell clásico de IA.

### Color

4. **No uses gradientes púrpura-a-azul.** Es el "VibeCode Purple".
   Aparece en el 27 % de las landing pages de Show HN. Si necesitas
   un acento, usa un color sólido con intención.

5. **No uses texto con gradiente.** Decorativo pero ilegible. Tell
   extremadamente común en headings y métricas AI.

6. **No shipes dark mode con texto gris medio sobre fondo oscuro.**
   El contraste casi siempre falla WCAG AA. Es el tell más común
   (34 % de Show HN). Si vas a usar dark mode, usa blanco/near-white
   para body text.

7. **Evita la paleta crema/beige cálida como superficie por defecto.**
   Es el "default tasteful AI" de 2025-2026. Si la usas, que sea por
   una razón de marca explícita.

### Layout

8. **No pongas un badge/pill chip justo encima del H1.** Es el template
   universal de hero AI. Si necesitas un kicker, inclúyelo en el titular
   o úsalo como breadcrumb.

9. **No uses tarjetas con borde coloreado en el lado izquierdo o superior.**
   Cita textual del estudio Krebs: *"los bordes izquierdos de color son
   casi tan señal fiable de IA como los em-dashes en texto"*.

10. **No uses grid de 3/6/9 feature cards idénticas con icono + título +
    texto corto.** Es el layout por defecto de homepage AI. Si necesitas
    features, varía tamaño, orden, o tratamiento visual.

11. **No uses radius idéntico en todo.** 16px en botón, card, input,
    sección y modal = look "blob uniforme". Varía el radius según función.

12. **No anides cards dentro de cards dentro de cards.** ("Cardocalypse").
    Aplana la jerarquía con spacing, tipografía y divisores.

### Componentes

13. **No uses iconos Lucide sin personalizar dentro de contenedores
    cuadrados redondeados apilados encima de headings.** Es la plantilla
    universal de feature-card AI. Si usas iconos, dalos tratamiento
    propio (stroke weight distinto, sin contenedor, o lateral al texto).

14. **No uses iconos emoji en nav o sidebar.** (🚀 ⚡ 🎯 🔒).
    Si necesitas iconografía, invierte en un set SVG custom.

15. **No uses shadcn/ui sin customizar color tokens, border-radius y
    shadows.** shadcn está diseñado explícitamente para copy-paste por
    agentes AI — sus defaults filtran tu sitio al "centro estadístico".

### Copy

16. **Carga `references/banned-words.md` y evita TODAS las palabras
    de la lista.** "delve", "seamless", "robust", "elevate", "navigate",
    "leverage", "comprehensive", "game-changer", "unlock", "tapestry",
    "realm" son los tells más citados en Reddit, OpenAI Community,
    Grammarly y LinkedIn.

17. **No sobreuses em-dashes (—) en body copy.** Más de 2 por página
    = marca de cadencia AI. Usa comas, dos puntos, paréntesis o puntos.

18. **Evita headlines aspiracionales vagos.** ("Build the future",
    "Scale without limits", "Your all-in-one platform"). Los headlines
    reales son específicos: Stripe = "Financial infrastructure to grow
    your revenue"; Linear = "The issue tracking tool you'll enjoy using".

19. **Evita paralelismos "It's not X, it's Y"** como recurso recurrente.
    Una vez está bien; la repetición es el tell.

20. **Evita tríadas rápidas (snappy triads)** como cadencia por defecto.
    La IA da tres ejemplos para todo. Rompe el patrón con dos, o cuatro,
    o un solo ejemplo desarrollado.

### Motion

21. **No apliques fade-in idéntico a todos los elementos al scroll.**
    El motion sin intención es uno de los fails más visibles de sitios
    AI. Si animas, que comunique cambio de estado, dirija atención, o
    refuerce personalidad.

22. **No uses bounce/elastic easing en diálogos o cards.** ("spring in
    with overshoot"). Se lee tacky y anticuado. Usa ease-out-quart/quint/expo.

23. **No escales o rotes imágenes al hover** salvo que haya intención
    específica. Es un opt-in tell reconocido.

### Código

24. **No comentes cada línea.** Los comentarios AI explican el "qué"
    (redundante) en lugar del "porqué". Si una línea necesita
    comentario, probablemente necesita renombrar una variable.

25. **No escribas docstrings exhaustivos (Args/Returns/Raises completos)
    en funciones triviales.** Es hiper-documentación antinatural.

26. **No generes funciones "demasiado completas y simétricas".** Todo
    branch manejado, todo caso documentado, error handling + logging +
    docs ya en sitio = el código llega "fully formed" en lugar de
    crecer incrementalmente como lo escribiría un humano.

27. **Mantén consistencia con el código circundante.** Si el codebase
    usa `camelCase` y tus aportaciones usan `snake_case`, se nota
    inmediatamente que fueron generadas en aislamiento.

---

## Principios contextuales (según estética elegida)

Lee `references/context-routing.md` para el detalle completo. Resumen:

### Editorial/Revista
- Serif para titulares (Tiempos, Freight Text, GT Sectra)
- Sans para cuerpo (Söhne, Untitled Sans, Haas Grotesk)
- Grilla rígida tipo periódico, columnas estrechas (max 65-75ch)
- Paleta limitada: 2-3 colores + blanco/negro
- Sin sombras, sin radius grande, sin gradientes
- Referencias: The New Yorker, The Economist, Stripe Press

### Brutalista/Suizo
- Helvetica / Neue Haas Grotesk / Söhne
- Alto contraste B/N con UN color de acento saturado
- Grilla modular estricta, alineación al milímetro
- Sin sombras, sin radius, sin gradientes
- Tipografía sola carga la jerarquía
- Referencias: Linear, Vercel (versión extrema), Kunsthaus

### Hand-crafted
- Tipografía custom o poco común (Bricolage, Migra, Inktrap)
- Ilustraciones SVG reales, no stock
- Texturas sutiles, imperfecciones intencionales
- Warm earth tones (terracotta, ochre, deep green, cream)
- Radius orgánico variado
- Referencias: Gumroad, Cargo, Are.na

---

## Integración con otras skills

Esta skill **complementa, no reemplaza**:

- **`/design-taste-frontend`**: capa visual de pulido y sistemas de
  diseño. Cargar human-touch DESPUÉS para auditar el resultado contra
  patrones AI.

- **`/high-end-visual-design`**: define tipografía, espaciados, sombras
  y animaciones específicas. human-touch añade la capa de "qué NO hacer".

- **`/minimalist-ui`** o **`/industrial-brutalist-ui`**: si el
  context-routing elige una de estas estéticas, cargar la skill
  correspondiente para la ejecución y human-touch para la auditoría.

- **`/emil-design-eng`**: para micro-interacciones. human-touch te dice
  qué motions evitar; emil-design-eng te dice cómo hacer bien los que sí.

- **`/grilling`**: si el usuario está indeciso sobre la dirección de
  diseño, recomendar `/grilling` antes de generar, para forzar decisiones
  explícitas anti-defaults.

---

## Anti-patrones de IA como referencia (cuándo cargar qué)

La skill incluye 5 archivos de referencia en `references/`. Carga cada
uno según el contexto:

| Archivo | Cuándo cargar |
|---|---|
| `context-routing.md` | SIEMPRE en modo GENERADOR, antes de elegir estética |
| `krebs-16-patterns.md` | En modo AUDITOR, para el reporte |
| `impeccable-46-rules.md` | En modo AUDITOR y al final del modo GENERADOR para auto-audit |
| `banned-words.md` | Siempre que vayas a escribir copy |
| `anti-ai-snippets.md` | En modo GENERADOR, para patrones de código concretos |

---

## Ejemplo de invocación

**Usuario**: "Rediseña la landing de mi SaaS de facturación para que no
se vea como vibe-coded."

**Tu flujo**:
1. Reconoces: modo GENERADOR (rediseño), contexto SaaS técnico.
2. Cargas `references/context-routing.md` → estética recomendada:
   Brutalista/Suiza (developer-adjacent B2B).
3. Cargas `references/anti-ai-snippets.md` para patrones CSS.
4. Aplicas las 27 Hard Rules durante la generación.
5. Al terminar, cargas `references/impeccable-46-rules.md` y auto-auditas.
6. Si slop score > 3, iteras.
7. Entregas con una nota explicando las decisiones de diseño tomadas
   (qué defaults rechazaste y por qué).

---

## Nota final

Esta skill es deliberadamente opinionated. Las reglas no son verdades
absolutas — son los patrones que la comunidad de diseñadores y
desarrolladores ha identificado como los tells más fiables de output
AI sin intención. Si el usuario pide explícitamente algo que viola
una Hard Rule (ej. "quiero Inter"), obedece al usuario, pero avisa
del tell y propone una alternativa.

El objetivo no es evitar la IA. Es **usarla sin perder la voz**.
