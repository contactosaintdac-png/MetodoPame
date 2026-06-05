# Integração com Google Calendar - Método Pame

Este documento explica como configurar a integração com o Google Calendar usando uma Service Account (Conta de Serviço).

## IMPORTANTE: Segurança e Produção

> [!WARNING]
> **NÃO USE A CHAVE DA SERVICE ACCOUNT DIRETAMENTE NO CÓDIGO FRONTEND EM PRODUÇÃO.**
> O código atual utiliza variáveis de ambiente (`VITE_GOOGLE_SERVICE_ACCOUNT_KEY`) apenas como placeholders/protótipo. Em um ambiente real, expor essa chave no cliente (Vite/React) permite que qualquer pessoa roube suas credenciais do Google Cloud.
> **Para produção real:** A chamada à API do Google Calendar (`src/lib/calendar.ts`) deve ser movida para um backend (como uma **Firebase Cloud Function**). O frontend fará apenas uma requisição para a sua Cloud Function, e ela se comunicará de forma segura com o Google Calendar.

---

## 1. Configurar o Projeto no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto ou selecione um existente (ex: seu projeto do Firebase `prospectadac` aparece aqui automaticamente).
3. Vá em **APIs & Services** > **Library**.
4. Pesquise por **Google Calendar API** e clique em **Enable** (Ativar).

## 2. Criar a Service Account (Conta de Serviço)

1. No Google Cloud Console, vá em **APIs & Services** > **Credentials**.
2. Clique em **+ Create Credentials** e selecione **Service Account**.
3. Dê um nome (ex: `pame-calendar-bot`).
4. Conclua a criação. Você verá um e-mail gerado, algo como: `pame-calendar-bot@seu-projeto.iam.gserviceaccount.com`. Copie este e-mail.
5. Clique na service account recém-criada, vá na aba **Keys** (Chaves).
6. Clique em **Add Key** > **Create new key** > Escolha **JSON**.
7. O arquivo `.json` será baixado. O conteúdo deste arquivo é a sua chave privada que, *quando passada para o backend*, fará a autenticação.

## 3. Preparar o Google Calendar de Pame

1. Abra o [Google Calendar](https://calendar.google.com/) da Pame (a conta onde os eventos devem aparecer).
2. Vá nas **Configurações** (engrenagem no canto superior direito) > **Configurações dos meus calendários** > Clique no calendário que deseja usar.
3. Role para baixo até **Compartilhar com pessoas ou grupos específicos**.
4. Clique em **Adicionar pessoas e grupos**.
5. Cole o **e-mail da Service Account** (passo 2.4) e dê a permissão **"Fazer alterações nos eventos"**. Isso permite que o bot crie os eventos na sua agenda.
6. Role mais para baixo até a seção **Integrar agenda**. Lá você encontrará o **ID da agenda** (geralmente o seu e-mail principal ou um ID longo terminando em `@group.calendar.google.com`). Copie esse ID.

## 4. Variáveis de Ambiente (.env.local)

No ambiente de testes local, adicione o ID do calendário e (se estivesse testando um script backend) a chave JSON. Como protótipo, criamos placeholders na aplicação atual:

```env
VITE_GOOGLE_CALENDAR_ID=ID_COPIADO_NO_PASSO_3.6
VITE_GOOGLE_SERVICE_ACCOUNT_KEY=CHAVE_JSON_COPIADA_NO_PASSO_2.7
```
