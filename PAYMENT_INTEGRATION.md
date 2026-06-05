# Integração com Mercado Pago - Método Pame

Este documento detalha como configurar a integração de pagamentos online usando o Mercado Pago.

## IMPORTANTE: Segurança em Produção

> [!WARNING]
> **NÃO EXPONHA O `ACCESS_TOKEN` NO FRONTEND.**
> O código atual possui `VITE_MP_ACCESS_TOKEN` como placeholder/protótipo. Em produção, a chave privada (Access Token) permite realizar transações e reembolsos. Se deixada no frontend (React/Vite), hackers podem roubá-la.
> **Para produção real:** A função `createPreference` definida em `src/services/mercadopago.ts` DEVE ser movida para um Backend (como uma **Firebase Cloud Function**). O frontend enviará os detalhes do pedido para o Backend, e o Backend fará a comunicação segura com o Mercado Pago e retornará apenas o link de pagamento (`init_point`).

---

## 1. Obter Credenciais do Mercado Pago

1. Acesse o painel de desenvolvedores do Mercado Pago: [Mercado Pago Developers](https://www.mercadopago.com.br/developers/pt)
2. Vá em **Suas integrações** > crie uma nova aplicação.
3. Na seção de **Credenciais de Produção**, você encontrará duas chaves cruciais:
   - **Public Key** (`VITE_MP_PUBLIC_KEY`)
   - **Access Token** (`VITE_MP_ACCESS_TOKEN`)

## 2. Configurar o Arquivo `.env.local`

Substitua os valores de placeholder pelas suas credenciais reais (lembre-se da ressalva de segurança para produção):

```env
VITE_MP_PUBLIC_KEY=APP_USR-seu-public-key
VITE_MP_ACCESS_TOKEN=APP_USR-seu-access-token
```

## 3. Fluxo de Ativação (Quando o Backend estiver pronto)

Quando o Backend estiver implementado, você deve alterar a tela de seleção de pagamento em `PricingMatrix.tsx`. 

No momento de clicar em "Pagar com Pix" ou "Pagar com Cartão":
1. Chame seu Backend para criar a preferência.
2. O Backend retornará uma URL do Mercado Pago (`init_point`).
3. Você substituirá a exibição do componente `<PaymentPending />` por um redirecionamento direto:
   `window.location.href = response.init_point;`

Pronto! O cliente será levado à tela segura do Mercado Pago para efetuar o pagamento e depois será redirecionado de volta para sua aplicação nas URLs de `success` ou `failure`.
