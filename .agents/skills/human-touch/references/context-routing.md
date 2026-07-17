# Context Routing — Elección de estética anti-AI por proyecto

> Guía para decidir cuál de las tres estéticas anti-AI aplicar según el
> tipo de proyecto. Basado en análisis de sitios "clean" del 46 % del
> estudio Krebs y recomendaciones de 925Studios, Artificial Ignorance,
> y discusiones en r/vibecoding, r/LocalLLM, r/webdev.

## Las tres estéticas anti-AI

### 1. Editorial / Revista

**Vibe**: Periódico de calidad, revista de diseño, libro técnico.

**Cuándo usar**:
- Portfolios personales (diseñadores, fotógrafos, escritores)
- Sitios de fundadores / consultoras boutique
- Medios y publicaciones
- Productos premium B2B (consultoría, legal, finanzas)
- Documentación técnica que se quiere leer como libro
- Sitios de marcas que quieren comunicar craftsman, tradition, authority

**Tipografía**:
- **Display**: Tiempos Headline, Freight Text, GT Sectra, Domaine
- **Body**: Söhne, Untitled Sans, Haas Grotesk, Tinos
- **Mono** (si aplica): JetBrains Mono, IBM Plex Mono
- **Pairing típico**: Serif display (títulos) + Sans body + Mono (código/datos)
- Evitar Inter en cualquier rol

**Paleta**:
- 2-3 colores + blanco/negro
- Base: blanco roto (#FAFAF7) o negro profundo (#0A0A0A)
- Acento: 1 color saturado usado con restricción
- Referencias: The Economist (#E3120B), The New Yorker, Stripe Press

**Layout**:
- Grilla rígida tipo periódico (12 columnas)
- Columnas estrechas para texto (max 65-75ch)
- Mucho whitespace vertical entre secciones
- Alineación al milímetro (no centrado)
- Sin sombras, sin radius grande, sin gradientes

**Referencias reales**:
- The Economist, Financial Times, The New Yorker
- Stripe Press (press.stripe.com)
- Are.na (editorial mode)
- Linear Blog (algunos posts)
- Marker (marker.medium.com)

**Skills que complementan**:
- `/minimalist-ui` (estética limpia)
- `/high-end-visual-design` (sistemas tipográficos)
- `/agency-brand-guardian` (consistencia tonal)

---

### 2. Brutalista / Suiza

**Vibe**: Linear extremo, Vercel docs, Kunsthaus, swiss design.

**Cuándo usar**:
- SaaS técnico / developer tools
- Infraestructura, DevOps, observabilidad
- APIs y SDKs
- Productos de seguridad
- Dashboards y herramientas internas
- Cualquier B2B donde la audiencia sea ingenieros

**Tipografía**:
- **Display y body**: Helvetica Neue, Neue Haas Grotesk, Söhne, Untitled Sans
- **Mono**: Söhne Mono, Berkeley Mono, JetBrains Mono
- Una sola familia sans en múltiples pesos
- Evitar serif completamente (en brutalista)
- Evitar Inter, Geist (overused)

**Paleta**:
- Blanco y negro de alto contraste
- UN color de acento saturado (rojo, amarillo, verde lima)
- Sin matices: blanco puro (#FFFFFF) y negro profundo (#000000)
- El color de acento se reserva para acción y estado, no decoración

**Layout**:
- Grilla modular estricta (8px o 12px base unit)
- Alineación al milímetro
- Tipografía sola carga la jerarquía (sin sombras ni radius)
- Sin radius (border-radius: 0)
- Sin sombras (box-shadow: none)
- Sin gradientes
- Borders hairline (1px solid)

**Referencias reales**:
- Linear (versión extrema)
- Vercel docs
- Drift
- Balenciaga (web)
- Kunsthaus Zürich
- Swiss International Style posters

**Skills que complementan**:
- `/industrial-brutalist-ui` (es la base)
- `/minimalist-ui`
- `/revenue-centric-design` (para conversión B2B)

---

### 3. Hand-crafted / Artesanal

**Vibe**: Gumroad, Cargo, Are.na, indie products con personalidad.

**Cuándo usar**:
- Productos consumer con marca fuerte
- Lifestyle, food, fashion, música
- Pequeñas marcas independientes
- Newsletters y blogs personales con voz
- Productos creativos (design tools, writing tools)
- Cualquier sitio donde la audiencia valora "personality" sobre polish

**Tipografía**:
- **Display**: Bricolage Grotesque, Migra, Inktrap, Canela, Söhne Breit
- **Body**: Untitled Sans, Söhne, Haas Grotesk
- **Script o display experimental**: Grand Slang, Editorial New, PP Editorial
- Mezclar 2-3 familias con confianza
- Tipografía custom o poco común es el diferenciador principal

**Paleta**:
- Warm earth tones: terracotta, ochre, deep green, cream, navy, burgundy
- Evitar blanco puro (#FFFFFF) — usar off-white warm (#F5F1EA)
- Evitar negro puro — usar ink (#1A1715)
- 3-4 colores que se sientan como una paleta de pintor
- Referencias: paletas de Aalto, Bauhaus textiles, año 70s editorial

**Layout**:
- Grilla más orgánica, no estricta
- Radius variado: 4px en inputs, 24px en cards destacadas, 0 en divisores
- Texturas sutiles (grain, paper)
- Imperfecciones intencionales (rotación de 0.5°, offset deliberado)
- Ilustraciones SVG custom, no stock
- Fotografía real con treatment (duotone, grain, color grade)

**Referencias reales**:
- Gumroad (gumroad.com)
- Cargo (cargo.site)
- Are.na
- Ladybug
- Coil (coil.com)
- Public-facing de fundadores indie en Twitter/X

**Skills que complementan**:
- `/design-taste-frontend` (sistemas de diseño pulidos)
- `/agency-visual-storyteller` (narrativa visual)
- `/emil-design-eng` (micro-interacciones orgánicas)

---

## Árbol de decisión

```
¿Quién es la audiencia principal?

├── Ingenieros / Devs / Technical buyers
│   └── Brutalista/Suiza
│
├── Diseñadores / Creativos / Medios
│   ├── ¿Quieres leer "premium"?
│   │   └── Editorial/Revista
│   └── ¿Quieres leer "indie"?
│       └── Hand-crafted
│
├── Fundadores / Consultoras / Premium B2B
│   └── Editorial/Revista
│
├── Consumer / Lifestyle
│   └── Hand-crafted
│
└── Mixto / Unsure
    └── Pregunta al usuario:
        "¿Qué tres sitios admiras visualmente?"
        → Si menciona Linear/Vercel/Stripe → Brutalista
        → Si menciona New Yorker/Economist/Stripe Press → Editorial
        → Si menciona Gumroad/Are.na/Cargo → Hand-crafted
```

## Preguntas para forzar la decisión

Si el usuario no especifica, hacer estas preguntas ANTES de generar
(comportamiento tipo /grilling pero enfocado en dirección estética):

1. **"Si tu sitio fuera una publicación física, ¿sería un libro, un
   periódico, o un zine?"**
   - Libro → Editorial
   - Periódico → Brutalista (grilla rígida) o Editorial
   - Zine → Hand-crafted

2. **"Muestra 3 sitios cuya estética admiras. No tienen que ser de tu
   industria."**
   - Linear, Vercel, Stripe, Notion → Brutalista/Suiza
   - Economist, New Yorker, Stripe Press → Editorial
   - Gumroad, Are.na, Cargo, Ladybug → Hand-crafted

3. **"¿Qué NO quieres que diga tu sitio?"**
   - "Que es una startup más" → Brutalista o Editorial
   - "Que es corporate" → Hand-crafted
   - "Que es un template" → Cualquiera con opinión fuerte

4. **"¿Quién es la audiencia: qué leen, qué usan, qué compran?"**
   - Lee Hacker News, usa VS Code → Brutalista
   - Lee The Atlantic, usa Things → Editorial
   - Lee It's Nice That, usa Are.na → Hand-crafted

## Override: cuándo mezclar estéticas

En proyectos grandes se puede mezclar, pero con reglas:

- **Editorial + Brutalista**: útil para SaaS premium (la home es
  editorial, la docs son brutalista). Ej: Stripe.
- **Brutalista + Hand-crafted**: útil para developer tools indie (la
  estructura es brutalista pero los detalles son hand-crafted).
  Ej: Bun.js.
- **Editorial + Hand-crafted**: útil para portfolios de creativos
  (estructura editorial, detalles artesanales). Ej: Pentagram.

**Regla**: una estética es la base (estructura, grilla, tipografía
principal), la otra es el acento (detalles, micro-interacciones,
ilustraciones). Nunca 50/50.

## Cuándo NONE de las tres aplica

- **Tiendas e-commerce**: la estética debe servir al producto, no
  eclipsarlo. Considerar base editorial + pulido comercial.
- **Government / institutional**: editorial sobrio, sin personalidad
  fuerte (reglas de accesibilidad estrictas).
- **Kids / education**: hand-crafted con colores saturados.
- **Gaming**: brutalista con efectos neón (excepción al "no neón" rule
  cuando la audiencia es gamers).

En estos casos, las Hard Rules del SKILL.md siguen aplicando — solo la
dirección estética cambia.

## Logs de decisión

Cuando generes en modo GENERADOR, documenta en un comentario al inicio
del archivo principal:

```html
<!--
  Estética elegida: Brutalista/Suiza
  Razón: SaaS técnico, audiencia ingenieros
  Skills complementarias: /industrial-brutalist-ui (estructura),
                          /emil-design-eng (motion)
  Hard Rules aplicadas: ver SKILL.md human-touch
  Defaults rechazados: Inter (→ Helvetica Neue), shadcn defaults
                       (radius=0, shadow=none), Lucide (→ SVG custom),
                       gradient púrpura (→ negro sólido)
-->
```

Esto obliga a decisiones explícitas y deja rastro para revisión futura.
