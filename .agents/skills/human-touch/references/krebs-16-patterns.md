# Los 16 patrones de Adrian Krebs (estudio Show HN, 2026)

> Fuente: Adrian Krebs, "Scoring Show HN submissions for AI design
> patterns". Estudio expandido a 1.590 landing pages de Hacker News
> Show HN, scored contra 16 patrones DOM/CSS vía Playwright.
> Discusión en HN: 333 puntos, 235 comentarios (abril 2026).

## Resumen del estudio

- **22 % heavy slop** (4+ patrones de 16)
- **32 % mild slop** (2-3 patrones)
- **46 % clean** (0-1 patrón)
- Más de la mitad de Show HN tiene huella visual de "generado por chat
  interface sin opinión".

Tells más comunes (frecuencia en el dataset):
1. Permanent dark theme — 34 %
2. Gradient backgrounds — 27 %
3. Icon-card grids — 22 %

## Los 16 patrones agrupados

### Fonts (3 patrones)

#### 1. Inter used for everything, especially the centered hero headline
Inter es la "Helvetica de la era LLM". Aparece por defecto en casi
todos los generadores. Si vas a usar Inter, emparéjala con una display
font con personalidad, o no la uses.

#### 2. The same font combos over and over
- Space Grotesk + Inter
- Instrument Serif + Inter
- Geist Serif italic como acento para UNA palabra dentro de un título Inter

Estos combos aparecen tan a menudo que se han vuelto tells por sí solos.

#### 3. Serif italics for accent words
Usar una serif en itálica para resaltar una sola palabra del título hero
("Build *beautiful* products") es el tic tipográfico más reconocible
de la era LLM 2025-2026.

### Colors (5 patrones)

#### 4. "VibeCode Purple"
Un tono específico de lila-púrpura que se filtra de la mayoría de
generadores de imagen y de prompts texto-a-landing. Si tu acento
principal es este púrpura, la página grita "vibe coded".

#### 5. Permanent dark mode with medium-grey body text
Dark mode por defecto con texto en gris medio (#a1a1aa, #71717a) sobre
fondo oscuro. El contraste casi siempre falla WCAG AA.

#### 6. All-caps section labels
"FEATURES", "PRICING", "WHAT YOU GET", "TESTIMONIALS" — etiquetas de
sección en mayúsculas con letter-spacing ancho son el scaffold
editorial por defecto de la IA.

#### 7. Barely-passing body-text contrast in dark themes
El problema funcional más grave del estudio. Generar dark themes
rutinariamente shipea body text que no pasa WCAG AA. Verificar con
contrast checker antes de publicar.

#### 8. Gradients everywhere + large colored glows and box-shadows
Gradientes en hero, CTA, fondos. Glows y box-shadows de color como
decoración. "Dark mode with purple accents is the default aesthetic
the LLMs reach for when you do not specify one."

### Layout quirks (8 patrones)

#### 9. Centered hero set in a generic sans
Hero centrado con H1 + subtítulo + 2 CTAs en sans serif genérico.
Casi nunca hay heros asimétricos o alineados a izquierda en output AI.

#### 10. Badge positioned right above the hero H1
Pill chip o badge minúscula con label uppercase justo encima del
título. Template universal de hero AI.

#### 11. Colored borders on cards, usually on the top or left edge
**El tell más específico de toda la lista.** Cita de un diseñador del
estudio: *"colored left borders are almost as reliable a sign of
AI-generated design as em-dashes are for AI-generated text"*.

#### 12. Identical feature cards with an icon on top
3, 6 o 9 cards idénticas con icono en contenedor + título + texto
corto. El layout por defecto de homepage AI.

#### 13. Numbered "1, 2, 3" step sequences
Pasos numerados con el mismo formato visual. Casi siempre 3 pasos,
casi siempre con icono.

#### 14. Stat banner rows
Filas de estadísticas: "10M+ users · 99.9% uptime · 200ms p50".
Stat layouts con número grande + label pequeña + acento en gradiente.

#### 15. Sidebar or nav with emoji icons
Navegación o sidebar con iconos emoji (🚀 ⚡ 🎯 🔒 📊). Es lo que
genera el modelo cuando no se especifica un set de iconos.

#### 16. All-caps headings and section labels
Titulares de sección en mayúsculas con tracking ancho. Refuerza el
look "scaffold editorial AI".

## Cómo usar esta lista

### En modo AUDITOR
Recorre el código HTML/CSS o el render visual y marca cuántos de los
16 patrones están presentes. Score:
- 0-1: Clean
- 2-3: Mild slop
- 4+: Heavy slop (urgente corregir)

### En modo GENERADOR
Antes de empezar, decide explícitamente para CADA patrón si lo vas a
evitar o si tienes una razón de diseño para usarlo. Documenta la
decisión en un comentario del código o en el README.

## Lo que el 46 % "clean" hace distinto

Del análisis cualitativo del estudio y discusiones posteriores en HN:

1. **Eligen paleta no-LLM-default**: earth tones, high-contrast
   black-and-bright, cream-and-pink (Gumroad), grey-and-blue (Stripe).
   Cualquier cosa con punto de vista. Explícitamente no lavender.

2. **Eligen sistema tipográfico no-Inter**: Geist, Haas Grotesk,
   Untitled Sans, Söhne, Inktrap, Migra. Emparejado con body font
   que tampoco sea Inter.

3. **Usan UN layout primitive fuerte y lo repiten**: no siete feature
   cards con siete tratamientos de icono distintos, ni tres stat
   banners y cuatro step sequences. Un primitivo, repetido hasta que
   se vuelve la firma visual del sitio.

Esta tercera disciplina es la de mayor leverage según Krebs.

## Referencia original

- Artículo completo: adriankrebs.ch/blog/design-slop
- Discusión HN: news.ycombinator.com (abril 2026, 333 puntos)
- Análisis en Developers Digest: developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it
