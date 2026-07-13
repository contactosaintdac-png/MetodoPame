# Auditoria de Produção e Segurança — Método Pame
*Status do Projeto: Pré-Lançamento*

Este relatório consolida a auditoria de segurança, SEO, usabilidade, performance e regras de negócio realizada pelos agentes especializados.

---

## 1. 🚨 Vulnerabilidade de Segurança Crítica: Manipulação de Preços (OWASP API Security)
- **O Problema:** A criação do checkout do Mercado Pago (`PricingMatrix.tsx` linha 97-98) envia o preço calculado no frontend (`totalPrice`) diretamente para o backend `/api/create-preference.ts`.
- **O Risco:** Um usuário mal-intencionado pode abrir o console de inspeção do navegador, interceptar a chamada do `fetch` e alterar o preço de `R$ 1.500` para `R$ 1,00`. O backend atual aceita e gera o link de pagamento cego de R$ 1,00, liberando o serviço.
- **A Solução:** O cálculo dos preços deve ser realizado ou verificado estritamente no backend. O frontend deve enviar apenas os dados do triage (número de quartos, banheiros, andares, adicionais selecionados e o tipo de turno), e o backend no servidor calcula o preço real antes de gerar a preferência do Mercado Pago.

---

## 2. 🛡️ Auditoria de Segurança: Banco de Dados e Firebase Rules
- **O Problema:** Não existe um arquivo de regras de segurança (`firestore.rules`) configurado no projeto. Se as regras do Firestore estiverem abertas em produção:
  - Qualquer pessoa pode alterar dados de especialistas na coleção `employees` e marcar-se como "ativo".
  - Qualquer pessoa pode ler o CPF e dados confidenciais das candidatas a especialistas.
  - Clientes podem ler reservas de outros clientes.
- **A Solução:** Criar e implantar o arquivo `firestore.rules` na raiz do projeto com políticas rígidas de isolamento de dados.

### Proposta de `firestore.rules` (Pronto para implantação):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Auxiliar: Verifica se o e-mail do usuário logado é Admin
    function isAdmin() {
      return request.auth != null && 
        (request.auth.token.email == 'metodopame.homedetail@gmail.com' || 
         request.auth.token.email == 'contactosaintdac@gmail.com');
    }

    // Auxiliar: Verifica se o usuário autenticado é o dono do documento
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Regras para Coleção de Especialistas (Funcionárias)
    match /employees/{employeeId} {
      // Qualquer um pode criar uma postulação (candidatura)
      // Mas a postulação DEVE entrar como 'pending' e inativa para segurança
      allow create: if request.resource.data.status == 'pending' 
                    && request.resource.data.active == false;
      
      // Apenas administradores podem ler ou modificar fichas completas
      allow read, write: if isAdmin();
      
      // Especialistas ativas podem ler seus próprios dados cadastrados
      allow read: if request.auth != null && request.auth.token.email == resource.data.email;
    }

    // Regras para Coleção de Clientes
    match /users/{userId} {
      allow read, write: if isAdmin() || isOwner(userId);
      
      match /profile/triage {
        allow read, write: if isAdmin() || isOwner(userId);
      }
      
      match /bookings/{bookingId} {
        allow read, write: if isAdmin() || isOwner(userId);
      }
      
      match /concierge_requests/{requestId} {
        allow read, write: if isAdmin() || isOwner(userId);
      }
    }

    // Regras para Agendas e Bloqueios de Especialistas
    match /employee_schedules/{employeeId}/blocks/{dateStr} {
      // Clientes precisam ler a disponibilidade para agendar
      allow read: if true;
      // Apenas o admin ou sistema de atribuição pode bloquear slots
      allow write: if isAdmin();
    }
  }
}
```

---

## 3. 🔍 Auditoria de SEO e Indexabilidade
- **Metatags Open Graph (Compartilhamento social):** O site não possui as tags `og:image`, `og:title` ou `og:description`. Ao compartilhar o link por WhatsApp ou Instagram, não carregará card visual com logo da marca.
- **Hierarquia Visual de Cabeçalhos:** Na página `/triage`, certas etapas carecem de tags semânticas `<section>` e os botões não usam rótulos ARIA adequados.

---

## 4. 🔀 Fluxos e Regras de Negócio (Gaps Operacionais)
- **Prevenção de Overbooking (Condição de Corrida):** O algoritmo de atribuição automática de especialistas é executado no client-side (`PricingMatrix.tsx`). Se dois clientes confirmarem o checkout do Mercado Pago ao mesmo tempo para a mesma especialista, o sistema pode alocar a mesma funcionária para ambos os serviços.
  - *Recomendação:* A confirmação final e escrita de bloqueio do calendário deve ser executada utilizando uma transação Firestore (`runTransaction`) para garantir atomicidade.

---

## 5. ⚡ Otimização de Banco de Dados (Composite Indexes)
- O console do navegador indica que a query de reservas por especialista (`collectionGroup('bookings')` filtrando por `assignedEmployeeId` e ordenando por `date`) precisa de um índice composto do Firestore.
- **Ação:** Adicionar o link gerado pelo Firebase no terminal para criar o índice composto correspondente no console do Firebase.

---

# 🛠️ Plano de Ação Imediato de Código

### Passo 1: Correção do Endpoint `/api/create-preference.ts`
Substituir o manipulador para recalcular o preço no servidor utilizando os parâmetros seguros enviados pelo cliente, impedindo fraudes.

### Passo 2: Ajustar a Chamada no Frontend (`PricingMatrix.tsx`)
Alterar o fetch da API para enviar a estrutura de triage de quartos/banheiros e adicionais, eliminando o envio direto de valores monetários.

### Passo 3: Adicionar Arquivo `firestore.rules`
Criar o arquivo na raiz do repositório para que seja commitado e implantado no Firebase.
