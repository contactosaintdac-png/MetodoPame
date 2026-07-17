# Anti-AI Code Snippets — Cómo NO vs cómo SÍ

> Patrones de código frontend que delatan generation AI, con la versión
> humana equivalente. Compilado de r/webdev, r/learnpython, r/C_Programming,
> AquilaX, Pangram Labs, Stack Overflow Blog, Facebook dev groups.

## Principio general

El código AI tiende a:
1. Llegar "fully formed" con error handling + logging + docs ya en sitio
2. Comentar cada línea explicando el "qué" en lugar del "porqué"
3. Usar defaults sin opinión (Tailwind default colors, shadcn sin
   customizar, Lucide icons sin tocar)
4. Generar simetría perfecta donde un humano tendría incrementalismo
5. Inconsistencia con código circundante (naming, patterns, formato)

---

## 1. Tipografía

### ❌ NO — Inter como única font

```html
<!-- Típico output AI -->
<div class="hero">
  <h1 class="text-6xl font-bold">Build the future of work</h1>
  <p class="text-xl text-gray-600">Your all-in-one platform for teams.</p>
</div>

<style>
  body { font-family: 'Inter', sans-serif; }
</style>
```

Problemas:
- Inter en todo (título, body, sin jerarquía)
- Headline aspiracional vago ("Build the future of work")
- Subtítulo cliché ("all-in-one platform")

### ✅ SÍ — Sistema tipográfico con contraste

```html
<div class="hero">
  <p class="kicker">Invoicing software for solo founders</p>
  <h1 class="hero__title">Send your first invoice<br>before lunch.</h1>
  <p class="hero__lede">No setup, no monthly fee. You pay 0.5% per paid invoice. That's it.</p>
</div>

<style>
  :root {
    --font-display: 'Tiempos Headline', 'Times New Roman', serif;
    --font-body: 'Söhne', 'Helvetica Neue', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .kicker {
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--ink-60);
    margin-bottom: 1.5rem;
    /* sin uppercase, sin letter-spacing excesivo */
  }

  .hero__title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    line-height: 1.05;
    letter-spacing: -0.02em; /* tighten display */
    font-weight: 400; /* romana, no bold */
    margin: 0 0 1.5rem;
  }

  .hero__lede {
    font-family: var(--font-body);
    font-size: 1.125rem;
    line-height: 1.6;
    max-width: 38ch; /* line-length humano */
    color: var(--ink-80);
  }
</style>
```

Diferencias:
- Serif display + sans body (jerarquía real)
- Headline específico (dice qué hace el producto)
- Subtítulo con dato concreto (0.5% per paid invoice)
- Kicker sin uppercase obsessive

---

## 2. Color

### ❌ NO — VibeCode Purple gradient

```html
<!-- Default AI slop -->
<button class="cta">
  Get started free
</button>

<style>
  .cta {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border-radius: 12px;
    padding: 12px 24px;
    /* sin :focus-visible, sin hover state intencional */
  }
</style>
```

### ✅ SÍ — Color sólido con intención

```html
<button class="cta" type="button">
  Send your first invoice
</button>

<style>
  .cta {
    background: var(--ink); /* negro profundo o color de marca */
    color: var(--paper);
    border-radius: 2px; /* radius pequeño = editorial */
    padding: 14px 28px;
    font: inherit;
    font-weight: 500;
    transition: transform 120ms ease-out, background 120ms ease-out;
  }

  .cta:hover {
    background: var(--ink-80);
    transform: translateY(-1px);
  }

  .cta:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .cta:active {
    transform: translateY(0);
  }
</style>
```

Diferencias:
- Color sólido (no gradient)
- Radius pequeño (2px = editorial, no 12-16px = blob AI)
- Hover state intencional (transform + bg)
- :focus-visible para accesibilidad
- CTA específica (no "Get started free")

---

## 3. Layout — Feature grid

### ❌ NO — Grid de 6 feature cards idénticas

```html
<!-- Default AI homepage -->
<section class="features">
  <h2>Why teams choose us</h2>
  <div class="features__grid">
    <div class="feature-card">
      <div class="feature-card__icon">🚀</div>
      <h3>Lightning fast</h3>
      <p>Supercharge your workflow with blazing-fast performance.</p>
    </div>
    <!-- ... 5 más idénticas ... -->
  </div>
</section>

<style>
  .features__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .feature-card {
    border: 1px solid #e5e7eb;
    border-left: 4px solid #8b5cf6; /* tell nº 1 de AI */
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
</style>
```

Problemas:
- 6 cards idénticas (template universal AI)
- Emoji icon (tell nº 15 de Krebs)
- Borde izquierdo de color (tell nº 11 de Krebs, el más específico)
- Radius 16px en todo
- Copy con "supercharge", "blazing-fast" (banned words)

### ✅ SÍ — Layout con primitivo único y variación

```html
<section class="features">
  <header class="features__header">
    <h2>What you actually get</h2>
    <p>Three things, done well. Not nine things, done average.</p>
  </header>

  <ol class="features__list">
    <li class="feature feature--lead">
      <span class="feature__number">01</span>
      <div class="feature__body">
        <h3>Invoices that get paid</h3>
        <p>Stripe and Wise integrations, automatic follow-ups at day 7, 14, 30. Average time-to-paid drops from 34 to 11 days.</p>
        <a href="/features/invoicing" class="feature__link">See how →</a>
      </div>
    </li>
    <li class="feature">
      <span class="feature__number">02</span>
      <div class="feature__body">
        <h3>Tax numbers that match</h3>
        <p>Local VAT, IRPF, IVA. Exportable as PDF or CSV. Accountant-friendly format by default.</p>
      </div>
    </li>
    <li class="feature">
      <span class="feature__number">03</span>
      <div class="feature__body">
        <h3>One dashboard, no tabs</h3>
        <p>Outstanding, overdue, paid. Three columns. That's the whole UI.</p>
      </div>
    </li>
  </ol>
</section>

<style>
  .features__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    border-top: 1px solid var(--ink-20);
  }

  .feature {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 24px;
    padding: 32px 0;
    border-bottom: 1px solid var(--ink-20);
  }

  .feature--lead {
    padding: 48px 0;
  }

  .feature__number {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--ink-40);
    /* no gradient, no accent color, no decoration */
  }

  .feature__body h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0 0 8px;
    font-weight: 400;
  }

  .feature__body p {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--ink-70);
    max-width: 55ch;
    margin: 0 0 12px;
  }

  .feature__link {
    font-size: 0.875rem;
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
</style>
```

Diferencias:
- Una lista, no un grid de cards
- Borde inferior (no izquierdo color)
- Número en mono (no icono emoji ni Lucide en container)
- Card lead más grande (jerarquía real)
- Copy específica con datos (34 → 11 días)
- Una sola CTA "See how →" en el lead, no en todas

---

## 4. Hero

### ❌ NO — Hero AI universal

```html
<section class="hero">
  <span class="hero__badge">✨ New: AI-powered insights</span>
  <h1>Scale your business without limits</h1>
  <p>The all-in-one platform that empowers teams to build, ship, and grow.</p>
  <div class="hero__ctas">
    <button>Get started free</button>
    <button class="ghost">Book a demo</button>
  </div>
  <div class="hero__stats">
    <div><strong>10M+</strong> users</div>
    <div><strong>99.9%</strong> uptime</div>
    <div><strong>200ms</strong> p50</div>
  </div>
</section>
```

Tells acumulados: badge con emoji ✨, headline aspiracional vago,
"all-in-one", "empowers", dos CTAs genéricas, stat banner row
(nº 14 de Krebs).

### ✅ SÍ — Hero con opinión

```html
<section class="hero">
  <p class="hero__meta">For solo founders · Pricing starts at $0</p>
  <h1>Invoicing software that doesn't<br>feel like accounting.</h1>
  <p class="hero__lede">Built by one founder who got tired of FreshBooks. No upsells, no "AI insights", no enterprise plan hidden behind a sales call. You send invoices. They get paid. That's the whole thing.</p>
  <a href="/signup" class="hero__cta">Send your first invoice →</a>
  <p class="hero__fineprint">No credit card. No trial expiration. You only pay 0.5% when an invoice is paid.</p>
</section>
```

Diferencias:
- No badge con emoji
- Headline específico con opinion ("doesn't feel like accounting")
- Lede con voz de founder, no marketing
- Una sola CTA específica
- Fineprint con dato concreto
- Sin stat banner

---

## 5. Comentarios en código

### ❌ NO — Comentarios AI

```typescript
// Function to process the user data
function processUserData(userData: UserData): ProcessedData {
  // Check if user data is valid
  if (!userData) {
    // Throw an error if user data is invalid
    throw new Error('User data is required');
  }

  // Initialize the result object
  const result: ProcessedData = {
    id: userData.id,
    name: userData.name,
    email: userData.email.toLowerCase(), // Convert email to lowercase
  };

  // Return the processed data
  return result;
}
```

Problemas:
- Comentarios que explican el "qué" (redundante)
- "Function to process the user data" — ya lo dice el nombre
- Comentario antes de cada línea obvia
- Docstring sería más útil

### ✅ SÍ — Comentarios humanos

```typescript
function normalizeUser(user: User): NormalizedUser {
  if (!user) throw new Error('User is required');

  // Lowercasing email here because Mailgun silently rejects
  // uppercase. Took us 3 days to debug in 2024.
  return {
    id: user.id,
    name: user.name.trim(),
    email: user.email.toLowerCase(),
  };
}
```

Diferencias:
- Cero comentarios redundantes
- Un solo comentario que explica "porqué" (no "qué")
- Nombre de función más preciso (normalize, no process)
- Sin over-documentation

---

## 6. CSS — Defaults sin opinión

### ❌ NO — Tailwind defaults sin customizar

```html
<div class="bg-gradient-to-r from-purple-500 to-blue-500
            rounded-2xl shadow-xl p-8 text-white">
  <h2 class="text-3xl font-bold">Get started today</h2>
  <p class="text-purple-100">Join thousands of teams</p>
</div>
```

Tells: gradient púrpura-azul, rounded-2xl, shadow-xl, text-purple-100.

### ✅ SÍ — Tailwind con tokens custom

```html
<!-- tailwind.config.js define ink, paper, accent como tokens -->
<div class="bg-ink text-paper p-8 rounded-sm border border-ink-20">
  <h2 class="font-display text-2xl">Try it on your next invoice</h2>
  <p class="text-ink-60 text-sm mt-2">No signup. Send one in 90 seconds.</p>
</div>
```

Diferencias:
- Color sólido (no gradient)
- rounded-sm (no rounded-2xl)
- Sin shadow-xl (border definido en su lugar)
- Tokens custom (ink, paper) no Tailwind defaults

---

## 7. Componentes shadcn/ui

### ❌ NO — shadcn sin customizar

```tsx
// Card shadcn recién instalada, sin tocar
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export function Feature() {
  return (
    <Card className="w-[350px]">
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
          <Rocket className="w-6 h-6 text-purple-600" />
        </div>
        <CardTitle>Launch faster</CardTitle>
        <CardDescription>Ship products at lightning speed</CardDescription>
      </CardHeader>
      <CardContent>
        <Button>Get started</Button>
      </CardContent>
    </Card>
  );
}
```

Tells: icon Lucide en container cuadrado rounded-lg, bg-purple-100,
"Launch faster", "lightning speed", "Get started" CTA genérica.

### ✅ SÍ — shadcn customizado

```tsx
// components.json override: radius=0.25rem, shadow=none, colors=ink/paper
import { Card } from "@/components/ui/card";

export function Feature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card className="border-b border-ink-20 rounded-none shadow-none p-8">
      <span className="font-mono text-xs text-ink-40">{n}</span>
      <h3 className="font-display text-xl mt-3 mb-2">{title}</h3>
      <p className="text-sm text-ink-70 leading-relaxed max-w-prose">{body}</p>
    </Card>
  );
}

// Uso:
<Feature
  n="01"
  title="Invoices that get paid"
  body="Stripe and Wise integrations, automatic follow-ups at day 7, 14, 30."
/>
```

Diferencias:
- Sin icon Lucide en container (cero icono, o SVG custom)
- rounded-none (override del default shadcn)
- shadow-none (override del default shadcn)
- border-b (no border completo ni left-border color)
- Número en mono (no icon)
- Props para reutilizar (no hardcoded copy)

---

## 8. JavaScript — Estructura "too polished"

### ❌ NO — Función fully-formed AI

```typescript
/**
 * Process a payment for the given amount.
 *
 * @param amount - The payment amount in the specified currency
 * @param currency - The ISO 4217 currency code
 * @param userId - The ID of the user making the payment
 * @returns A dictionary containing status, transaction_id, and timestamp
 * @throws {ValueError} If amount is negative or currency is invalid
 * @throws {PaymentError} If the payment processor returns an error
 */
async function processPayment(
  amount: number,
  currency: string,
  userId: string
): Promise<PaymentResult> {
  if (amount <= 0) {
    throw new Error(`Amount must be positive, got ${amount}`);
  }
  if (!VALID_CURRENCIES.has(currency)) {
    throw new Error(`Invalid currency: ${currency}`);
  }
  try {
    const result = await stripe.charges.create({ /* ... */ });
    logger.info(`Payment processed for user ${userId}`, { result });
    return {
      status: 'success',
      transaction_id: result.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Payment failed for user ${userId}`, { error });
    throw new PaymentError(error.message);
  }
}
```

Problemas:
- Docstring exhaustivo en función común
- Tipado TypeScript completo en todo
- Error handling + logging + returns tipados
- Symmetric structure (cada branch igual de detallado)

### ✅ SÍ — Función incremental humana

```typescript
async function charge(amount: number, currency: string, userId: string) {
  if (amount <= 0) throw new Error('amount must be positive');

  // TODO: handle currency validation properly — for now, Stripe rejects
  const result = await stripe.charges.create({
    amount: Math.round(amount * 100),
    currency,
    customer: userId,
  });

  return result.id;
}
```

Diferencias:
- Nombre corto (charge, no processPayment)
- Sin docstring (la firma ya dice todo)
- TODO honesto (un humano lo dejaría, AI lo llenaría)
- Sin try/catch (deja que el error propague)
- Sin logger.info en happy path
- Sin tipado exhaustivo (TS infiere)
- Return directo (id), no objeto wrapper

---

## Checklist final antes de publicar

Antes de entregar código generado:

- [ ] ¿Hay Inter como única font? → cambiar
- [ ] ¿Hay gradientes púrpura-azul? → cambiar
- [ ] ¿Hay border-left/right de color en cards? → quitar
- [ ] ¿Hay grid de 3/6/9 feature cards idénticas? → romper patrón
- [ ] ¿Hay emoji icons en nav? → reemplazar con SVG custom
- [ ] ¿Hay shadcn sin customizar radius/shadow? → override
- [ ] ¿Hay comentarios que explican el "qué"? → borrar
- [ ] ¿Hay docstrings en funciones triviales? → borrar
- [ ] ¿Hay "delve", "seamless", "robust" en el copy? → reescribir
- [ ] ¿Hay >2 em-dashes en el body? → redistribuir
- [ ] ¿Hay stat banner (10M+ users · 99.9% uptime · 200ms)? → quitar
- [ ] ¿Hay headline aspiracional vago? → hacer específico
- [ ] ¿Hay fade-in idéntico en todos los elementos? → quitar o variar
- [ ] ¿Hay dark mode con texto gris? → subir contraste o usar blanco

Si 0 checks marcados → ship.
Si 1-3 checks marcados → corregir antes de ship.
Si 4+ checks marcados → rehacer desde el principio.
