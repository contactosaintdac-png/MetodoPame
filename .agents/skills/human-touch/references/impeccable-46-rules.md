# Las 46 reglas de Impeccable — catálogo completo (2026)

> Fuente: impeccable.style/slop
> 46 patrones que marcan una interfaz como generada por IA.
> 41 reglas deterministas (CLI o browser), 4 opt-in provider tells
> (--gpt / --gemini), 5 necesitan LLM review.
> Detector ejecutable: `npx impeccable detect` o browser extension.

## Cómo leer este catálogo

Cada regla tiene:
- **Detección**: CLI (determinista desde archivos) / Browser (necesita
  layout real) / LLM only (no determinista)
- **Tipo**: AI slop (tell de IA) / Quality (mal diseño en general)
- **Opt-in**: tell específico de provider (GPT o Gemini), off por defecto

## Visual Details (7 reglas)

### 1. Rounded card with thick colored border
**Detección:** CLI · **Tipo:** AI slop
El borde coloreado grueso choca con el radius. Tipicamente 3-4px
colored border en una card con border-radius. Remover el borde o
remover el radius.

### 2. Border accent on rounded element
**Detección:** CLI · **Tipo:** AI slop
Borde acento grueso en card redondeada. El borde choca con las
esquinas redondeadas. Remover el borde o el border-radius.

### 3. Frosted glass card / Glassmorphism everywhere
**Detección:** LLM only · **Tipo:** AI slop
Blur effects, glass cards, glow borders usados como decoración en
lugar de para resolver un problema real de layering.

### 4. Alert title with thick colored stripe on one side
**Detección:** CLI · **Tipo:** AI slop
Stripe grueso de color en un lado de un alert o callout.

### 5. Side-tab accent border
**Detección:** CLI · **Tipo:** AI slop
**El tell más reconocible de UI generada por IA.** Borde grueso de
color en un lado de una card. Usar un acento más sutil o removerlo.

### 6. Ghost card: hairline border with wide soft shadow
**Detección:** CLI · **Opt-in** · **Tipo:** AI slop
Border 1px (hairline) + sombra amplia y difusa. Firma recurrente de
generated-UI. Comprométete con uno: borde definido O elevación suave,
no ambos a la vez.

### 7. Repeating-gradient stripes
**Detección:** CLI · **Opt-in** · **Tipo:** AI slop
Stripes de gradiente repetido como decoración de superficie. Busca
textura deliberada o deja la superficie lisa.

### 8. Extreme border-radius on cards (24px+)
**Detección:** LLM only · **Tipo:** AI slop
Over-rounding cards, sections e inputs (24px y superior en card
pequeña) convierte todo en el mismo soft blob. Cards: 12-16px max.
Full-pill reservado para tags y botones.

### 9. Amateurish hand-drawn SVG
**Detección:** LLM only · **Tipo:** AI slop
Ilustraciones SVG hand-coded de escenas o mascotas que se leen como
garabatos amateur. Si no puedes renderizar con assets reales, mejor
no illustration que fallback sketchy.

## Typography (10 reglas)

### 10. Flat type hierarchy
**Detección:** CLI · **Tipo:** AI slop
Font sizes demasiado juntas. Sin jerarquía visual clara. Usar menos
tamaños con más contraste (ratio mínimo 1.25 entre escalones).

### 11. Icon tile stacked above heading
**Detección:** CLI · **Tipo:** AI slop
Pequeño contenedor cuadrado redondeado con icono apilado encima de
un heading. Es la plantilla universal de AI feature-card. Probar
side-by-side o dejar el icono en flow sin contenedor.

### 12. Italic serif display headline
**Detección:** CLI · **Tipo:** AI slop
Serif itálica sobredimensionada como headline hero principal. Se ha
vuelto el universal AI-startup landing hero. Ponerla en romana o
mover a una display face no-serif.

### 13. Hero eyebrow / pill chip
**Detección:** CLI · **Tipo:** AI slop
Pequeño label uppercase con letter-spacing inmediatamente encima de
un headline hero sobredimensionado, o el mismo shape como pill chip.
Es el default AI SaaS hero. Dropear el eyebrow, fold el kicker en el
headline, o usar breadcrumb.

### 14. Repeated section kicker labels
**Detección:** CLI · **Tipo:** AI slop
Repetir labels minúsculos uppercase tracked encima de headings de
sección. Convierte la página de marca en scaffolding editorial AI.
Reemplazar con estructura más fuerte, artifacts, imagery, o un
sistema de marca deliberado.

### 15. Oversized hero headline
**Detección:** CLI · **Tipo:** AI slop
Headline de frase completa a tamaño display que domina el viewport,
sin dejar espacio para nada más above the fold. Un headline punchy de
1-2 palabras a ese tamaño está bien; el problema es frase larga
sobre-dimensionada.

### 16. Crushed letter spacing
**Detección:** CLI · **Tipo:** AI slop
Letter spacing apretado más allá del punto donde los caracteres
mantienen su shape. Cuesta legibilidad. Tighten display type
ópticamente, no destructivamente.

### 17. Overused font (Inter, Geist, Space Grotesk, Instrument Serif)
**Detección:** CLI · **Tipo:** AI slop
Usadas en tantos sitios que ya no se sienten distintivas. Cada nueva
ola de UIs AI converge en el mismo puñado de fonts. Elegir una face
que dé personalidad a la interfaz.

### 18. Single font for everything
**Detección:** CLI · **Tipo:** AI slop
Solo una familia tipográfica para toda la página. Emparejar display
font distintiva con body font refinada para crear jerarquía
tipográfica.

### 19. All-caps body text
**Detección:** CLI · **Tipo:** Quality
Pasajes largos en uppercase son difíciles de leer. Reconocemos
palabras por shape (ascenders y descenders), que all-caps elimina.
Reservar uppercase para labels cortos y headings.

### 20. Long passages in uppercase (heading context)
**Detección:** CLI · **Tipo:** Quality
Variante de la anterior. Mismo fix.

## Color & Contrast (5 reglas)

### 21. AI color palette (purple/violet gradients, cyan-on-dark)
**Detección:** CLI · **Tipo:** AI slop
Los tells más reconocibles de UI generada por IA. Elegir paleta
distintiva e intencional.

### 22. Dark mode with glowing accents (neon on dark)
**Detección:** CLI · **Tipo:** AI slop
Fondos oscuros con box-shadow glows de color. Es el look "cool" por
defecto de UIs AI. Usar lighting sutil y purposeful o skipear el
dark theme.

### 23. Gradient text
**Detección:** CLI · **Tipo:** AI slop
Texto con gradiente es decorativo, no significativo. Tell común
especialmente en headings y métricas. Usar colores sólidos para texto.

### 24. Gray text on colored background
**Detección:** CLI · **Tipo:** Quality
Gris se ve washed out sobre fondos de color. Usar un shade más oscuro
del color de fondo o blanco/near-white para contraste.

### 25. Cream / beige palette as default "tasteful" surface
**Detección:** CLI · **Tipo:** AI slop
Fondo warm cream o beige se ha vuelto la superficie AI "tasteful" por
defecto, reached for por reflexo. Elegir background que venga de
paleta deliberada, no del warm off-white seguro.

## Layout & Space (8 reglas)

### 26. Hero metric layout
**Detección:** LLM only · **Tipo:** AI slop
Big number, small label, tres supporting stats, acento en gradiente.
Usado en todas partes, confiado en ninguna.

### 27. Identical card grids
**Detección:** LLM only · **Tipo:** AI slop
Cards del mismo tamaño con icono + heading + texto repetido
endless. El default AI homepage layout.

### 28. Monotonous spacing
**Detección:** CLI · **Tipo:** AI slop
El mismo valor de spacing en todas partes. Sin ritmo, sin variación.
Usar groupings apretados para items relacionados y separaciones
generosas entre secciones.

### 29. Nested cards (cards inside cards inside cards)
**Detección:** CLI · **Tipo:** AI slop
Cards anidadas crean noise visual y depth excesivo. Aplanar la
jerarquía: usar spacing, tipografía y divisores en lugar de anidar
contenedores.

### 30. Numbered section markers (01 / 02 / 03)
**Detección:** CLI · **Tipo:** AI slop
Marcadores display numerados como labels de sección. Es el scaffold
editorial AI un tier más profundo que tracked eyebrow chips. Los
números ganan su lugar solo cuando la sección ES realmente una
secuencia.

### 31. Line length too long (>80 chars)
**Detección:** Browser · **Tipo:** Quality
Líneas más anchas que ~80 caracteres cuesta leerlas. El ojo pierde el
sitio volviendo al inicio de la siguiente línea. Añadir max-width
(65ch a 75ch) a contenedores de texto.

### 32. Content overflowing its container
**Detección:** Browser · **Tipo:** Quality
Content renderiza más ancho que su contenedor, spillando o forzando
scroll horizontal. Dejar wrap al texto, constrain widths, o dar
scroll affordance deliberado.

### 33. Positioned child clipped by overflow container
**Detección:** Browser · **Tipo:** Quality
Container con overflow hidden/clip wraping un child absolutamente
posicionado corta tooltips, menus y popovers. Dejar overflow visible
o mover la layer posicionada fuera del clip.

## Motion (3 reglas)

### 34. Bounce or elastic easing
**Detección:** CLI · **Tipo:** AI slop
Bounce y elastic easing en interface elements (dialog que springs in,
card que overshoots) se siente dated y tacky. Reservar spring physics
para cosas que son físicas. Ease interface motion out suavemente
(ease-out-quart/quint/expo).

### 35. Layout property animation
**Detección:** CLI · **Tipo:** Quality
Animar width, height, padding o margin causa layout thrash y jank.
Usar transform y opacity, o grid-template-rows para height animations.

### 36. Image hover transform (scale/rotate)
**Detección:** CLI · **Opt-in** · **Tipo:** AI slop
Escalar o rotar imagen al hover. Firma recurrente de generated-UI.
Dejar imagery quieta o usar interacción más sutil y purposeful.

## Copy (4 reglas)

### 37. Em-dash overuse
**Detección:** CLI · **Tipo:** AI slop
Más de un par de em-dashes en body copy es un tell de cadencia AI.
Usar comas, colons, periods o parentheses.

### 38. Marketing buzzword
**Detección:** CLI · **Tipo:** AI slop
Frases SaaS genéricas (streamline, empower, supercharge, world-class,
enterprise-grade) son tells instantáneos. Elegir verbo y noun
específicos que digan qué hace literalmente el producto.

### 39. Aphoristic-cadence copy
**Detección:** CLI · **Tipo:** AI slop
Secciones que landean en un short rebuttal o un manufactured-contrast
aphorism se leen como cadencia AI, no voz. Una vez OK; el patrón
repetido es el tell.

### 40. Theater framing copy
**Detección:** CLI · **Opt-in** · **Tipo:** AI slop
Dismissar algo como "theater" es un tic recurrente de generated-copy.
Decir plain qué hace o no hace la cosa.

## Imagery (1 regla)

### 41. Broken or placeholder image
**Detección:** CLI · **Tipo:** Quality
`<img>` con src vacío, missing o placeholder shipa como broken-image
boxes. Usar imágenes reales, assets generados, o remover el tag.

## General Quality (5 reglas adicionales del catálogo)

### 42. Cramped padding
**Detección:** Browser · **Tipo:** Quality
Texto demasiado cerca del edge de su container. Aumentar padding
interno para dar respiración.

### 43. Low contrast text
**Detección:** Browser · **Tipo:** Quality
Texto con contraste insuficiente contra el fondo. Verificar contra
WCAG AA (4.5:1 para body, 3:1 para large text).

### 44. Missing focus states
**Detección:** Browser · **Tipo:** Quality
Elementos interactivos sin :focus-visible styling. Accesibilidad
básica para keyboard navigation.

### 45. Inconsistent button styles
**Detección:** CLI · **Tipo:** Quality
Múltiples variants de botón primario en la misma página sin razón.
Definir sistema de botones y respetarlo.

### 46. Misaligned elements
**Detección:** Browser · **Tipo:** Quality
Elementos que no alinean a la grilla. Utilizar grid o flex alignment
explícito.

## Slop Score (cómo reportarlo)

```
Slop Score: X/46
- Visual Details: X/9
- Typography: X/11
- Color & Contrast: X/5
- Layout & Space: X/8
- Motion: X/3
- Copy: X/4
- Imagery: X/1
- General Quality: X/5

Buckets:
- 0-2: Clean
- 3-6: Mild slop
- 7+: Heavy slop (urgente)
```

## Referencia

- Catálogo live: impeccable.style/slop
- Ejecutar detector: `npx impeccable detect <path>` o browser extension
- 11 specimen pages para testear: impeccable.style/slop (sección "Try it live")
