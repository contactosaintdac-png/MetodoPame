# Plano de Implementação — Redesenho Móvel Responsivo (Estilo Aplicativo Uber)

Este plano detalha o redesenho e adaptação responsiva da **Área do Cliente (`/minha-area`)** e do **Checkout (`/pricing`)** para telas de celular. O objetivo é aproximar a experiência móvel do conceito simplificado de fluxo e usabilidade do **Uber**, aplicando a estética premium **Quiet Luxury (Silk & Stone)** sem alterar, remover ou adicionar funcionalidades, regras de negócio ou botões que não sejam operacionais.

---

## Diretrizes de Design & Usabilidade Móvel

### 1. Navegação de Aplicativo Fixo
* **PC**: Mantém a barra lateral elegante (`aside`) com navegação de tabs.
* **Celular**: Substitui a barra de rolagem horizontal superior atual por uma **Barra de Navegação Inferior Fixa (Bottom Navigation Bar)** com as 5 abas principais: *Início* (Dashboard), *Reservas* (Calendário), *VIP* (Indicações), *Histórico* (Faturas) e *Concierge* (Suporte).

### 2. Dashboard do Cliente (Início) no Celular
* **Residência Cadastrada**: Um cabeçalho visual com tipografia elegante e um card minimalista representando o lar cadastrado do cliente (ex: "Sua Residência: 3 Quartos • 2 Banheiros").
* **Acesso Direto (Conceito Uber)**: Um botão ou card flutuante destacado para **"Solicitar Novo Atendimento"** que redireciona diretamente ao checkout/triage, facilitando a ação primária do cliente.
* **Especialista Designada**: Se houver um atendimento programado, exibe os dados da especialista (nome, foto/iniciais) em um formato de card semelhante ao perfil de motorista do Uber, respeitando os dados do Firestore.

### 3. Matriz de Investimento (Checkout) no Celular
* **Layout Fluido**: Transformação da matriz de preços em blocos verticais fluidos.
* **Cards Táteis**: Os botões de seleção de turnos, tamanhos e serviços adicionais (addons) usarão sombras neumórficas suaves (`silk-lift`, `silk-inset`) e dimensões otimizadas para toque.
* **Resumo / Bottom Sheet**: O cálculo dinâmico de preços no rodapé será exibido em um card fixo inferior (tipo Bottom Sheet) com o botão principal de confirmação.

---

## Proposta de Mudanças

### Componentes de UI

#### [MODIFY] [MinhaArea.tsx](file:///c:/Users/leshx/Downloads/DESARROLLO/Método-Pame/src/components/MinhaArea.tsx)
* **Barra de Navegação Inferior**: Implementar menu fixo no rodapé (`fixed bottom-0 left-0 w-full z-40 md:hidden bg-[#fff7fd]/95 backdrop-blur-md border-t border-[#efe5ee] ...`) com ícones e labels adaptadas para tela cheia de celular.
* **Aba Dashboard**:
  * Adicionar cabeçalho com foto de perfil em círculo elegante (à direita) e saudação principal.
  * Adicionar card de visualização da residência com o sumário de cômodos (quartos, banheiros).
  * Adicionar botão de destaque primário para "Solicitar Novo Atendimento" (redireciona para o checkout).
  * Adaptar o card de próximo atendimento para formato de cartão de perfil com foto de perfil e status estruturado ("Atendimento Confirmado" / "Alocando Especialista").
* **Aba Reservas**:
  * Reduzir o espaçamento do calendário mensal no mobile para que caiba na tela sem quebrar.
  * Otimizar o cartão de detalhes da reserva selecionada para que apareça abaixo do calendário de forma fluida.
* **Abas Círculo VIP, Histórico e Suporte**:
  * Otimizar os inputs de texto, caixas de diálogo do chat concierge e listas de faturas para que usem 100% de largura no mobile com padding de toque adequado (mínimo 44px).
  * Manter o comportamento padrão do chat, avaliações em estrelas e download de faturas em PDF exatamente como no PC.

#### [MODIFY] [PricingMatrix.tsx](file:///c:/Users/leshx/Downloads/DESARROLLO/Método-Pame/src/components/PricingMatrix.tsx)
* **Visualização da Matriz**: Ajustar a grade de preços para se comportar como cards empilhados verticalmente no mobile.
* **Lista de Addons**: Ajustar as colunas e o tamanho das pílulas de seleção de serviços adicionais no celular.
* **Bottom Sheet de Preço Estimado**: Fixar o rodapé de cálculo de investimento no mobile para fácil acesso ao botão "Reservar Cuidados Estritos".
* **Calendário de Agendamento (Modal)**: Otimizar o grid de dias do calendário dentro do modal de reserva para telas estreitas.

---

## Plano de Verificação

### Verificação de Integridade
1. Certificar que nenhum campo de formulário, botão de ação, script de Mercado Pago ou gatilho de e-mail/notificação foi modificado na sua lógica subjacente.
2. Certificar que a Área de Equipe (`/equipe`) e o Painel Admin (`/admin`) não sofreram impactos.

### Testes Manuais
1. **Responsividade de Navegação**:
   * Abrir o site no console do navegador e emular dispositivos móveis (ex: iPhone, Pixel).
   * Validar se a barra lateral da Área do Cliente desaparece e é substituída pela barra inferior no mobile.
2. **Navegação pelas Abas**:
   * Clicar em cada ícone da barra inferior e verificar se o conteúdo de cada seção carrega corretamente sem quebras de layout.
3. **Fluxo de Reserva (Checkout)**:
   * Acessar o Checkout (`/pricing`), selecionar turnos, incluir addons e validar se o cálculo do total funciona em tempo real.
   * Abrir o modal de reserva, selecionar datas no calendário e verificar se o fluxo avança até a tela de pagamento.

### Sincronização do Grafo
* Após aplicar as alterações, executar a atualização do grafo de conhecimento do projeto:
  `graphify update .`
