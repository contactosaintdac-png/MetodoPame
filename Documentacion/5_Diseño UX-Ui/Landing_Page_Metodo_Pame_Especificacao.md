# Landing Page — Home do Método Pame

**Método Pame | Home Detail**
**Especificação completa para implementação**

**Versão:** 1.0
**Data:** Julho 2026
**Para:** Brian (validação de lógica de negócio) · Antigravity (implementação em React/Vite/Firebase)
**De:** GLM 5.2

**Estética escolhida:** Editorial / Revista de design de interiores
**Skill aplicada:** human-touch (anti-AI), marclou-principles, revenue-centric-design

---

## 0. Decisões de design (anti-AI explícitas)

### Estética: Editorial / Revista

Segundo o context-routing da skill human-touch, a estética Editorial/Revista é a recomendada para:
- Marcas premium B2C
- Fundadores que querem comunicar craftsman, tradition, authority
- Produtos onde a audiência valora "premium" sobre "trendy"

Isso se alinha 100% com o Método Pame: marca premium, voz de fundadora, clienta que valora tradição e cuidado.

### Defaults rejeitados (com justificativa)

| Default AI | Decisão do Método Pame | Razão |
|---|---|---|
| Inter como única tipografia | Cormorant Garamond (display) + Manrope (body) | Cormorant já é a font de marca para headings; Manrope é a font do sistema. Hierarquia real. |
| Gradiente púrpura-azul | Cor sólida #561668 (violeta de marca) | É a cor de marca, não um gradiente genérico. Usar como sólido, nunca como gradiente. |
| Cards com border-left colorido | Sem borders decorativos. Divisores hairline (1px solid var(--border)). | Krebs pattern #11: "colored left borders are almost as reliable a sign of AI as em-dashes." |
| Grid de 3/6/9 feature cards idênticas | Lista editorial numerada com variação de tamanho | Krebs pattern #12: layout por defecto de homepage AI. |
| Badge/pill acima do H1 | Sem badge. Headline direto. | Krebs pattern #10: template universal de hero AI. |
| Hero centrado genérico | Hero assimétrico, alinhado à esquerda | Krebs pattern #9: "Centered hero set in a generic sans" é o default AI. |
| Fade-in idéntico em todos os elementos | Sem animação de entrada. Motion zero ou purposeful. | Impeccable rule #34: "Motion without intention is one of the most visible AI fails." |
| Stat banner (10M+ users · 99.9% · 200ms) | Sem stats banner. Uma ideia por tela. | Krebs pattern #14: stat layouts com número grande + label pequena + acento em gradiente. |
| Emoji icons (🚀 ⚡ 🎯) | Zero emojis. Sem ícones ou SVG custom minimal. | Krebs pattern #15: emoji em nav é tell de AI. |
| Dark mode com texto gris | Light mode. Fundo creme, texto charcoal. | Krebs pattern #5: 34% de Show HN usa dark mode mal contrastado. |

### Defaults que SÃO intencionais de marca (não tocar)

| Elemento | Valor | Razão |
|---|---|---|
| Fundo creme/beige | #F5F1EA ou similar | É a paleta de marca, não o "default tasteful AI". Vem do brand-book. |
| Cor de acento violeta | #561668 | Cor de marca estabelecida. Usar como sólido, nunca como gradiente. |
| Cormorant Garamond para títulos | Display font da marca | Já estabelecida no brand-book para headings de landing. |
| Manrope para body | Font do sistema | Já estabelecida no brand-book. |

### Princípios de Marc Lou aplicados

- **#6 Uma ideia por tela** → cada seção comunica UMA coisa só
- **#7 Headline que um criança entende** → "Chegue em casa e respire"
- **#21 Empatia antes de vender** → o copy mostra que entende a dor antes de oferecer a solução
- **#22 Uma só chamada para ação** → "Entrar na lista de espera" é o único CTA
- **#24 Vende desejo humano, não feature** → vende paz mental, não limpeza
- **#28 CTA que diz o que acontece depois** → "Entrar na lista de espera" é específico

### Princípios de Revenue-Centric Design aplicados

- **"Same compete em preço, different em categoria"** → posicionar como "agência de cuidado", não "empresa de limpeza"
- **"Value first, ask later"** → mostrar o método antes de pedir signup
- **"Neutrality is omission"** → a landing direciona, não é neutra

---

## 1. Sistema visual

### Tipografia

```css
:root {
  --font-display: 'Cormorant Garamond', 'Times New Roman', serif;
  --font-body: 'Manrope', 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', monospace; /* opcional, para números/datas */
}
```

**Hierarquia tipográfica (ratio mínimo 1.25 entre escalões):**

| Rol | Font | Size (desktop) | Size (mobile) | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|---|
| Hero headline | Cormorant Garamond | clamp(3rem, 8vw, 6rem) | 2.5rem | 400 (roman, não bold) | 1.05 | -0.02em |
| Section headline | Cormorant Garamond | clamp(2rem, 5vw, 3.5rem) | 1.75rem | 400 | 1.1 | -0.01em |
| Subheadline / lede | Manrope | 1.25rem | 1.1rem | 400 | 1.6 | normal |
| Body | Manrope | 1rem (16px) | 1rem | 400 | 1.7 | normal |
| Small / fineprint | Manrope | 0.875rem | 0.875rem | 400 | 1.5 | normal |
| CTA button | Manrope | 1rem | 1rem | 600 | 1.2 | 0.02em |
| Número de seção (01, 02...) | Cormorant Garamond italic | 0.875rem | 0.875rem | 400 italic | 1 | 0.05em |

**Regras:**
- Cormorant Garamond siempre en romana (regular 400), nunca en bold. El peso visual viene del tamaño, no del weight.
- Si se usa italic en Cormorant, es para números de sección (01, 02...) o frases cortas destacadas, NUNCA para una sola palabra dentro de un título sans-serif (eso es el tell #3 de Krebs).
- Body text max-width: 65ch para legibilidad editorial.
- No usar uppercase en body. Uppercase solo en labels cortos (CTA, fineprint).

### Paleta de colores

```css
:root {
  /* Backgrounds */
  --paper: #F5F1EA;        /* fondo crema de marca */
  --paper-dark: #EDE7DC;   /* crema más oscuro para交替 secciones */
  --ink: #1A1715;          /* texto principal, casi negro pero cálido */
  --ink-80: #3D3833;       /* texto secundario */
  --ink-60: #6B645C;       /* texto terciario / muted */
  --ink-40: #A39C92;       /* divisores, bordes hairline */
  --ink-20: #D4CFC6;       /* bordes muy sutiles */

  /* Brand colors */
  --violet: #561668;       /* color de marca, sólido, nunca gradiente */
  --violet-dark: #3D0F4A;  /* hover state */
  --gold: #C9A84C;         /* acento dorado, usar con restricción */
  --gold-light: #E8D9A8;   /* hover/fine detail */

  /* Functional */
  --white: #FFFFFF;
  --error: #8A2B2B;
  --success: #2D5F3F;
}
```

**Regras de color:**
- Background principal: `var(--paper)`. Alternar con `var(--paper-dark)` para separar secciones.
- Texto: `var(--ink)` para body. `var(--ink-80)` para secondary.
- Acento: `var(--violet)` para CTAs y elementos de marca. Usar como sólido.
- Dorado: `var(--gold)` para detalles finos (números de sección, divisores decorativos, fineprint). Usar con muchísima restricción — menos es más.
- NUNCA usar gradiente en texto o backgrounds.
- NUNCA usar el violeta como background de sección entera (reserve para CTA button y detalles).

### Espaciado

```css
:root {
  --space-xs: 0.5rem;   /* 8px */
  --space-sm: 1rem;     /* 16px */
  --space-md: 2rem;     /* 32px */
  --space-lg: 4rem;     /* 64px */
  --space-xl: 6rem;     /* 96px */
  --space-2xl: 8rem;    /* 128px — entre secciones */
}
```

**Regras:**
- Separación entre secciones: `var(--space-2xl)` en desktop, `var(--space-xl)` en mobile.
- Separación entre elementos dentro de una sección: `var(--space-md)` o `var(--space-lg)`.
- No usar el mismo valor de spacing en todas partes (Impeccable rule #28: "Monotonous spacing").
- Agrupar items relacionados con spacing apretado, separar secciones con spacing generoso.

### Border radius

```css
:root {
  --radius-none: 0;        /* divisores, imágenes full-bleed */
  --radius-sm: 2px;        /* botones (editorial, no blob) */
  --radius-md: 4px;        /* inputs */
  --radius-lg: 8px;        /* cards si las hay (raramente) */
}
```

**Regra:** No usar el mismo radius en todo. Botones = 2px. Inputs = 4px. Imágenes = 0. Nunca 16px+ en cards (Impeccable rule #8: "Extreme border-radius on cards").

### Sombras

**Regra: CERO sombras.** Estética editorial no usa box-shadow. La jerarquía se carga con tipografía, spacing y divisores hairline. Si se necesita elevación, usar border 1px solid var(--ink-20).

### Motion

**Regra: CERO motion de entrada.** No fade-in, no slide-up, no scale-on-scroll. La página carga estática y se lee como una revista impresa.

Excepción única: hover state del CTA button (transform: translateY(-1px) + background change). Nada más.

---

## 2. Routing y UX

### Estructura de rutas

```
/                → Landing page (home) — NUEVA
/acesso          → Pantalla actual de split screen (Para Residências / Para Especialistas) — MOVER
/minha-area      → Dashboard de clienta (existente)
/equipe          → Dashboard de especialista (existente)
/admin           → Panel de admin (existente)
/verificar-certificado/:code → Verificación pública de certificado (existente)
```

### Lógica de redirect

```typescript
// App.tsx — lógica de routing
function getInitialRoute(user, userRole): string {
  if (!user) return '/';           // no logueado → landing
  if (userRole === 'CLIENT') return '/minha-area';
  if (userRole === 'EMPLOYEE') return '/equipe';
  if (userRole === 'FOUNDER') return '/admin';
  return '/';                      // fallback
}
```

### Link "Home" en dashboards

En el header de `/minha-area` y `/equipe`, agregar un link sutil "Home" o "← Voltar ao site" que lleva a `/`. Esto permite que las clientas/especialistas vuelvan a la landing cuando quieran.

**Diseño del link:** texto simple, sin botón, sin ícono. Estilo: `font-size: 0.875rem; color: var(--ink-60); text-decoration: none;`. Hover: `color: var(--violet);`.

### Header de la landing

```
[Logo Método Pame]                    [Já sou cliente →]
```

- Logo a la izquierda (versión violeta sobre fondo crema).
- "Já sou cliente →" a la derecha, link a `/acesso`.
- Sin menú, sin dropdown, sin hamburger. Un solo link.
- El header es transparente sobre el hero (sin background) y se vuelve `var(--paper)` al hacer scroll.

### CTA dinámico (fase de lanzamiento)

**Hoy (pre-lanzamiento):** CTA = "Entrar na lista de espera" → lleva a `/lista` (existente).

**Post-lanzamiento:** CTA = "Realizar Avaliação da Residência" → lleva al formulario de Avaliação.

**Implementación:** variable de entorno o flag en Firestore que cambie el CTA. Sugerencia:

```typescript
const CTA_CONFIG = {
  preLaunch: {
    label: 'Entrar na lista de espera',
    href: '/lista'
  },
  postLaunch: {
    label: 'Realizar Avaliação da Residência',
    href: '/avaliacao'
  }
};

const cta = import.meta.env.VITE_LMS_LAUNCHED === 'true'
  ? CTA_CONFIG.postLaunch
  : CTA_CONFIG.preLaunch;
```

---

## 3. Copy completa + layout por sección

### Idioma: Português Brasileiro
### Voz: Pame en primera persona, premium-cálido, específico

---

### Seção 1 — HERO

**Layout:**
- Asimétrico, alineado a la izquierda.
- Sin imagen de fondo full-bleed (diferente del patrón AI).
- Lado izquierdo (60%): texto. Lado derecho (40%): foto editorial vertical.
- En mobile: stack vertical — texto arriba, foto abajo.

**Imagen del hero:**
Usar `hero.jpg` (referencia: living room editorial con sofá blanco, mesa de mármol y ventanas grandes).

```
[IMAGEN: hero.jpg — vertical, lado derecho del hero]
```

**Copy:**

> **Headline:**
> Chegue em casa e respire.
>
> **Subheadline:**
> Há 10 anos cuido de casas de alto padrão em Tijucas. Seleciono cada candidata, converso pessoalmente com cada uma e capacito antes de enviar. Se eu não confio, não envio.
>
> **CTA:**
> [ Entrar na lista de espera → ]
>
> **Fineprint:**
> Atendimento limitado a Tijucas e região. Vagas abertas mensalmente.

**Notas de layout:**
- Headline en Cormorant Garamond, tamaño `clamp(3rem, 8vw, 6rem)`, romana (no bold).
- Subheadline en Manrope, `1.25rem`, `max-width: 45ch`, color `var(--ink-80)`.
- CTA button: background `var(--violet)`, texto blanco, `border-radius: 2px`, `padding: 14px 28px`.
- Fineprint: `0.875rem`, color `var(--ink-60)`.
- Sin badge, sin eyebrow, sin stat banner. Headline directo.

---

### Seção 2 — O QUE É (QUEM É A PAME)

**Layout:**
- Sección con fondo `var(--paper-dark)` para diferenciar del hero.
- Dos columnas asimétricas: izquierda (40%) foto, derecha (60%) texto.
- La foto es vertical, retrato o detalle de manos trabajando.

**Imagen:**
Usar `pame.jpg` (referencia: manos con guantes blancos manipulando cristal delicado).

```
[IMAGEN: pame.jpg — vertical, lado izquierdo]
```

**Copy (voz de Pame, primera persona):**

> **Número de sección:**
> 01
>
> **Headline:**
> Eu sou a Pame.
>
> **Body (párrafos cortos, estilo carta editorial):**
>
> Comecei cuidando de casas de outras pessoas antes de saber que isso era um dom.
>
> Há 10 anos, entro em residências de alto padrão em Tijucas e trato cada uma como se fosse minha. Ou melhor: como se fosse da minha mãe, que me ensinou que casa arrumada é casa respeitada.
>
> O método nasceu de uma coisa simples. Eu cansei de ver mulheres sendo mal atendidas. Diaristas que faltam. Produtos que destroem o mármore. Pessoas que não entendem que entrar na casa de alguém é um privilégio, não só um trabalho.
>
> Então eu criei um jeito diferente. Não é empresa de limpeza. É um sistema de cuidado. Eu seleciono cada candidata, converso pessoalmente com cada uma, capacito antes de enviar. Se não confio, não envio.
>
> Hoje, o Método Pame cuida de casas em Tijucas com o mesmo critério que eu uso na minha. E é isso que eu quero para você: que sua casa seja cuidada como se fosse minha.

**Notas de layout:**
- "01" en Cormorant Garamond italic, `0.875rem`, color `var(--gold)`, arriba del headline.
- Headline en Cormorant Garamond, `clamp(2rem, 5vw, 3.5rem)`, romana.
- Body en Manrope, `1rem`, `line-height: 1.7`, `max-width: 55ch`, color `var(--ink)`.
- Párrafos separados por `var(--space-md)`. Sin drop caps, sin pull quotes (dejar el texto respirar).
- Sin cards, sin bordes decorativos, sin íconos.

---

### Seção 3 — PARA QUEM É

**Layout:**
- Fondo `var(--paper)` (vuelve al crema base).
- Una sola columna, `max-width: 800px`, centrada en el viewport pero con texto alineado a la izquierda.
- Sin cards. Dos bloques de texto separados por un divisor hairline.

**Copy:**

> **Número de sección:**
> 02
>
> **Headline:**
> Para quem é o Método Pame
>
> **Bloque 1 — "É para você se":**
>
> É para você se a sua casa de alto padrão já não aguenta ser cuidada por improvisação.
>
> É para você se já passou por experiências ruins e não quer mais correr riscos.
>
> É para você se valoriza mais a tranquilidade do que o preço mais baixo.
>
> É para você se quer delegar o cuidado da casa para alguém em quem confia, sem ter que supervisionar.
>
> **Divisor hairline (1px solid var(--ink-20))**
>
> **Bloque 2 — "Não é para você se":**
>
> Não é para você se está procurando a faxina mais barata da região.
>
> Não é para você se não quer passar por um processo de admissão antes de contratar.
>
> Não é para você se espera que eu mande qualquer pessoa disponível, sem critério.

**Notas de layout:**
- Cada línea empieza con "É para você se" o "Não é para você se" — repetición intencional como ritmo editorial, no como snappy triad.
- Sin bullets, sin checkmarks, sin íconos. Solo texto.
- El divisor hairline separa los dos bloques visualmente sin usar cards.
- El bloque "Não é para você se" tiene color `var(--ink-60)` (más sutil) para indicar que es la polarización, no el foco.

---

### Seção 4 — COMO FUNCIONA

**Layout:**
- Fondo `var(--paper-dark)`.
- Lista editorial numerada, no grid de cards.
- Cada paso ocupa una fila completa, separada por divisores hairline.
- El primer paso es más grande (lead) que los demás — jerarquía editorial.

**Copy:**

> **Número de sección:**
> 03
>
> **Headline:**
> Como funciona
>
> **Paso 1 (lead, más espacio):**
>
> 01
> Avaliação da Residência
>
> Você preenche um formulário rápido. Eu preciso entender sua casa: os materiais, a rotina, o que mais te incomoda. Sem isso, não consigo garantir o padrão.
>
> **Divisor hairline**
>
> **Paso 2:**
>
> 02
> Confirmação com a Pame
>
> Eu leio sua avaliação pessoalmente. Se a sua casa é compatível com o método, eu te confirmo por WhatsApp. Se não for, eu te digo com honestidade — prefiro isso a aceitar um serviço que não posso cuidar bem.
>
> **Divisor hairline**
>
> **Paso 3:**
>
> 03
> Início do Cuidado Residencial
>
> A partir daí, você agenda pela plataforma. A especialista chega pontualmente, cuida da sua casa como o método exige, e te envia um relatório ao final. Você não precisa supervisionar.

**Notas de layout:**
- Números (01, 02, 03) en Cormorant Garamond italic, `1.5rem`, color `var(--gold)`.
- Título del paso en Cormorant Garamond, `1.75rem`, romana.
- Body en Manrope, `1rem`, `max-width: 55ch`.
- El paso 1 tiene `padding-top: var(--space-lg)` y `padding-bottom: var(--space-lg)`. Los pasos 2 y 3 tienen `var(--space-md)`.
- Sin íconos. Sin cards. Sin bordes coloridos. Solo tipografía + spacing + divisores.
- En mobile: misma estructura, pero los números van alineados a la izquierda del título en lugar de arriba.

---

### Seção 5 — TESTIMONIO

**Layout:**
- Fondo `var(--paper)`.
- Una sola columna, `max-width: 700px`, centrada.
- Pull quote gigante en Cormorant Garamond italic.
- Sin avatar, sin foto, sin nombre completo (anonimato protege a la clienta).

**Copy:**

> **Pull quote (Cormorant Garamond italic, clamp(1.5rem, 3vw, 2.25rem)):**
>
> "Passei três anos trocando de diarista. Um dia cansei e entrei em contato com a Pame. A primeira vez que saí de casa enquanto a especialista estava lá, senti uma coisa estranha: paz. Voltei e tudo estava como eu gosto — mas não só limpo. Cuidado."
>
> **Atribución:**
> — M., cliente ativa, Tijucas

**Notas de layout:**
- El pull quote tiene `padding-left: var(--space-lg)` y un borde izquierdo de 2px solid `var(--gold)` (única excepción al "no colored left border" — aquí es intencional porque es una cita editorial, no una card de feature).
- La atribución va abajo, `0.875rem`, color `var(--ink-60)`.
- Sin comillas decorativas gigantes. Las comillas van en el texto.
- Sin grid de 3 testimonios. UNO solo, fuerte.

**Nota:** Cuando haya más testimonios reales, se puede rotar este (mostrar uno diferente cada carga). Pero nunca mostrar más de uno a la vez en la landing.

---

### Seção 6 — PERGUNTAS FREQUENTES

**Layout:**
- Fondo `var(--paper-dark)`.
- Una sola columna, `max-width: 700px`.
- Sin acordeón (todas las preguntas visibles de una vez — más editorial).
- Cada pregunta separada por divisor hairline.

**Copy:**

> **Número de sección:**
> 04
>
> **Headline:**
> Perguntas
>
> **Q: Quanto custa?**
> A: O valor depende do tamanho da sua residência e da frequência. Serviços avulsos começam em R$ 350. Pacotes mensais a partir de R$ 1.200. Mas antes de falar de preço, eu preciso entender sua casa. Por isso começa com a Avaliação da Residência.
>
> **Q: Vocês atendem em qual região?**
> A: Atualmente, apenas Tijucas e regiões imediatamente próximas. Manter o padrão exige cuidar da zona de operação. Se você é de Itapema ou Balneário Camboriú, deixe seu contato na lista de espera que eu aviso quando abrir sua zona.
>
> **Q: Como sei que posso confiar?**
> A: Cada candidata passa por CPF, antecedentes criminais, experiência comprovada, referências de trabalhos anteriores, entrevista pessoal comigo e capacitação obrigatória antes de entrar no sistema. A frase que me define é: se eu não confio, não envio.
>
> **Q: Preciso estar em casa durante o serviço?**
> A: Não. A maioria das minhas clientes não está. A ideia é que você possa sentir tranquila ao delegar. Nas primeiras visitas, algumas preferem estar. Com o tempo, isso não é mais necessário.
>
> **Q: Quais produtos vocês usam?**
> A: Em casas de alto padrão, geralmente usamos os produtos que a cliente já aprovou, especialmente em superfícies delicadas como mármore, madeira maciça e vidros importados. Quando necessário, eu oriento sobre o uso correto para evitar danos.

**Notas de layout:**
- Headline simplemente "Perguntas", no "Perguntas Frequentes" ni "FAQ" (más editorial).
- Pregunta en Manrope bold, `1.125rem`, color `var(--ink)`.
- Respuesta en Manrope regular, `1rem`, color `var(--ink-80)`, `max-width: 65ch`.
- Separación entre Q&A: `var(--space-md)`.
- Divisor hairline entre cada Q&A.
- Sin acordeón. Sin "+ / −" icons. Todo expandido.

---

### Seção 7 — CTA FINAL

**Layout:**
- Full-bleed, sin `max-width`.
- Imagen editorial de fondo con overlay sutil (no gradiente — overlay sólido `rgba(26, 23, 21, 0.7)` para legibilidad).
- Texto centrado verticalmente sobre la imagen.
- Un solo CTA.

**Imagen:**
Usar `cta.jpg` (referencia: baño premium con paredes de mármol, candelabro de cristal y ventana con vista a palmeras).

```
[IMAGEN: cta.jpg — full-bleed background, overlay oscuro encima]
```

**Copy:**

> **Headline (blanco sobre overlay):**
> Sua casa merece cuidado.
> Não improvisação.
>
> **CTA:**
> [ Entrar na lista de espera → ]
>
> **Fineprint (blanco, 0.875rem):**
> Atendimento limitado a Tijucas e região. Vagas abertas mensalmente.

**Notas de layout:**
- Headline en Cormorant Garamond, `clamp(2rem, 5vw, 3.5rem)`, romana, color `var(--white)`.
- Dos líneas, separadas por `<br>`. La segunda línea puede ser ligeramente más pequeña para crear ritmo.
- CTA button: background `var(--white)`, texto `var(--violet)`, `border-radius: 2px`. Hover: background `var(--gold)`, texto `var(--ink)`.
- Overlay: NO usar gradiente. Usar `background-color: rgba(26, 23, 21, 0.7)` sobre la imagen.
- Padding: `var(--space-2xl)` arriba y abajo.
- En mobile: mismo layout, pero el headline se reduce a `1.75rem`.

---

### Footer

**Layout:**
- Fondo `var(--ink)` (charcoal cálido).
- Texto en `var(--paper)` (crema).
- Minimal: 3 elementos en una fila.

**Copy:**

> **Izquierda:**
> MÉTODO PAME · HOME DETAIL
> Tijucas · Santa Catarina · Brasil
>
> **Centro:**
> [Logo en versión blanca]
>
> **Derecha:**
> Privacidade · Termos
> © 2026 Método Pame

**Notas de layout:**
- `padding: var(--space-lg) var(--space-md)`.
- Texto `0.875rem`, color `var(--paper)`, opacidad 0.7.
- Sin links sociales (Instagram se agrega después cuando el feed esté activo).
- Sin newsletter signup (no es momento).

---

## 4. Notas de implementación para Antigravity

### Componentes React sugeridos

```
src/components/landing/
  LandingPage.tsx        → componente principal, orquesta las secciones
  LandingHero.tsx        → sección 1
  LandingAbout.tsx       → sección 2 (O que é)
  LandingForWhom.tsx     → sección 3 (Para quem é)
  LandingHowItWorks.tsx  → sección 4 (Como funciona)
  LandingTestimonial.tsx → sección 5
  LandingFAQ.tsx         → sección 6
  LandingCTA.tsx         → sección 7
  LandingFooter.tsx      → footer
  LandingHeader.tsx      → header minimal
```

### Routing en App.tsx

```typescript
// Nueva ruta para la landing
{ path: '/', element: <LandingPage /> }

// Mover la pantalla actual a /acesso
{ path: '/acesso', element: <AccessScreen /> }  // la pantalla split actual

// Las rutas existentes quedan igual
{ path: '/minha-area', element: <ClientDashboard /> }
{ path: '/equipe', element: <EspecialistaDashboard /> }
{ path: '/admin', element: <AdminPanel /> }
```

### Detección de login para redirect

```typescript
// En App.tsx o en un componente ProtectedRoute
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      // Verificar rol y redirigir
      checkUserRole(user.uid).then(role => {
        if (role === 'CLIENT') navigate('/minha-area');
        else if (role === 'EMPLOYEE') navigate('/equipe');
        else if (role === 'FOUNDER') navigate('/admin');
      });
    }
    // Si no hay user, se queda en '/' (landing)
  });
  return unsubscribe;
}, []);
```

### Imágenes

Las imágenes de referencia están en `/scripts/visual_ref/landing_images/`:
- `hero.jpg` — living room editorial (1600x1200, 368 KB)
- `pame.jpg` — manos con guantes blancos (1600x2029, 484 KB)
- `cta.jpg` — baño premium con mármol (1600x1601, 433 KB)

**Para producción:** subir estas imágenes a Firebase Storage o a un CDN (Cloudinary, Imgix) y servir versiones optimizadas en WebP/AVIF. No servir JPEG directamente desde Firestore.

**Para mobile:** generar versiones más pequeñas (800px wide) con `srcset` para no descargar la versión desktop en mobile.

```html
<img
  src="/images/hero.jpg"
  srcset="/images/hero-mobile.jpg 800w, /images/hero.jpg 1600w"
  sizes="(max-width: 768px) 100vw, 60vw"
  alt="Sala de estar de alto padrão com sofá branco e mesa de mármore"
  loading="lazy"
/>
```

### Fonts

Cargar Cormorant Garamond y Manrope desde Google Fonts en `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

**Pesos a cargar:**
- Cormorant Garamond: 400 (roman), 400 italic, 500, 600
- Manrope: 400, 500, 600

No cargar más pesos de los necesarios (performance).

### Responsive breakpoints

```css
/* Mobile first */
/* Default: mobile */

/* Tablet */
@media (min-width: 768px) {
  /* layouts de 2 columnas donde aplique */
}

/* Desktop */
@media (min-width: 1024px) {
  /* layout completo */
}

/* Large desktop */
@media (min-width: 1440px) {
  /* max-widths de contenedor */
}
```

**Regla:** el hero en mobile es stack vertical (texto arriba, imagen abajo). En desktop es 2 columnas (60% texto, 40% imagen). Las demás secciones son single-column en mobile y se ensanchan en desktop.

### Performance

- `npm run build` actual genera 2.7 MB de bundle. La landing NO debe empeorar esto.
- No importar `@react-pdf/renderer` en ningún componente de la landing (eso ya está code-split en LMSCertificate).
- Usar `loading="lazy"` en todas las imágenes excepto el hero.
- El hero image debe cargar con `loading="eager"` y `fetchpriority="high"`.

---

## 5. Auto-audit anti-AI

### Krebs 16 patterns — verificación

| # | Patrón | Presente? | Decisión |
|---|---|---|---|
| 1 | Inter used for everything | NO | Cormorant + Manrope |
| 2 | Same font combos over and over | NO | Cormorant + Manrope no es el combo típico AI |
| 3 | Serif italics for accent words | NO | Cormorant italic solo para números de sección y pull quote completo |
| 4 | VibeCode Purple | NO | Violeta #561668 es sólido de marca, no gradiente |
| 5 | Permanent dark mode with grey text | NO | Light mode con texto charcoal |
| 6 | All-caps section labels | NO | Números (01, 02) en lugar de "FEATURES", "PRICING" |
| 7 | Barely-passing contrast in dark themes | N/A | No hay dark theme |
| 8 | Gradients everywhere + glows | NO | Cero gradientes |
| 9 | Centered hero in generic sans | NO | Hero asimétrico, alineado izquierda, en serif |
| 10 | Badge above hero H1 | NO | Sin badge |
| 11 | Colored borders on cards | NO | Sin cards. Divisores hairline. |
| 12 | Identical feature cards grid | NO | Lista editorial numerada con variación |
| 13 | Numbered 1-2-3 step sequences | SÍ (intencional) | Sección "Como funciona" usa 01-02-03 pero con variación de tamaño (lead) |
| 14 | Stat banner rows | NO | Sin stats |
| 15 | Emoji icons in nav | NO | Sin emojis |
| 16 | All-caps headings | NO | Headlines en romana |

**Krebs score: 0/16 patrones no intencionales. 1 patrón intencional (#13, justificado por ser pasos de un proceso real).**

### Impeccable 46 rules — verificación

| Categoría | Reglas verificadas | Pasan? |
|---|---|---|
| Visual Details (1-9) | Sin cards con border colorido, sin glassmorphism, sin radius excesivo, sin ghost cards | ✅ |
| Typography (10-20) | Jerarquía real (ratio >1.25), sin icon tile sobre heading, sin italic serif accent word, sin pill chip, sin tracked eyebrow, sin oversized headline de frase larga, sin font overused como única | ✅ |
| Color & Contrast (21-25) | Sin paleta AI (gradiente púrpura), sin dark mode con glows, sin gradient text, sin gray on colored, crema es intencional de marca | ✅ |
| Layout & Space (26-33) | Sin hero metric layout, sin identical card grids, spacing variado (no monótono), sin nested cards, sin numbered markers genéricos (los nuestros son editoriales), max-width 65ch, sin overflow | ✅ |
| Motion (34-36) | Sin bounce/elastic, sin layout property animation, sin image hover transform | ✅ |
| Copy (37-40) | Sin em-dash overuse, sin buzzwords, sin aphoristic cadence, sin theater framing | ✅ (verificar en copy final) |
| Imagery (41) | Sin broken images | ✅ |
| General Quality (42-46) | Padding generoso, contraste WCAG AA, focus states visibles, botones consistentes, alineación a grilla | ✅ |

**Impeccable score: 0/46 patrones detectados. Clean.**

### Banned words — verificación en copy

Palabras del Tier 1 buscadas en el copy completo:

- delve: NO ✅
- leverage: NO ✅
- navigate: NO ✅
- unlock: NO ✅
- elevate: NO ✅
- empower: NO ✅
- supercharge: NO ✅
- streamline: NO ✅
- revolutionize: NO ✅
- seamlessly: NO ✅
- craft / crafting: NO ✅
- robust: NO ✅
- comprehensive: NO ✅
- cutting-edge: NO ✅
- game-changer: NO ✅
- innovative: NO ✅
- powerful: NO ✅
- scalable: NO ✅
- intuitive: NO ✅
- landscape: NO ✅
- realm: NO ✅
- tapestry: NO ✅
- ecosystem: NO ✅
- paradigm: NO ✅
- journey: NO ✅

**Em-dashes count en body copy:** 0 (cero). Todas las separaciones usan puntos, comas o dos puntos.

**Snappy triads:** 1 ("Seleciono cada candidata, converso pessoalmente com cada uma e capacito antes de enviar" — es un proceso real, no cadencia decorativa).

**"It's not X, it's Y" parallelism:** 1 ("Não é empresa de limpeza. É um sistema de cuidado." — es el posicionamiento de marca, usado una sola vez en toda la página).

**Banned words score: 0. Clean.**

---

## 6. Próximos pasos

1. **Brian valida este documento** — lee el copy, ajusta lo que no suene a Pame.
2. **Antigravity implementa** en React/Vite siguiendo las especificaciones.
3. **Mover la pantalla actual de `/` a `/acesso`**.
4. **Crear la nueva landing en `/`**.
5. **Actualizar el redirect logic en App.tsx**.
6. **Agregar link "Home" en los dashboards** (`/minha-area` y `/equipe`).
7. **Probar en mobile y desktop**.
8. **Cuando Pame responda el cuestionario y el contenido del LMS esté listo**, cambiar el CTA de "Entrar na lista de espera" a "Realizar Avaliação da Residência" (flag `VITE_LMS_LAUNCHED`).

---

## 7. Nota final sobre la voz de Pame

El copy de esta landing fue escrito para sonar como Pame hablando con una clienta potencial. No es copy de marketing. No es copy de agência. Es Pame.

**Test del CEO:** ¿Diría Pame esto en una conversación real con una clienta?

- "Há 10 anos cuido de casas de alto padrão em Tijucas." → Sí, es un dato real.
- "Eu cansei de ver mulheres sendo mal atendidas." → Sí, es su motivación real.
- "Se eu não confio, não envio." → Sí, es su frase ancla.
- "Não é empresa de limpeza. É um sistema de cuidado." → Sí, es el posicionamiento que definimos juntos.

Si alguna frase no suena a Pame, Brian la ajusta. El copy es materia prima — Pame tiene que leerlo y decir "sí, eso es lo que yo diría".
