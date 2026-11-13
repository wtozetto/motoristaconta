# MotoristaConta | ContaRota

Aplicação para motoristas de Uber, 99 e Indrive acompanharem ganhos, km, gastos e lucro.

- **Dados pessoais no navegador.** IndexedDB (Dexie) + LocalStorage.
- **Contador de usuários:** função serverless consulta o Supabase e atualiza o número exibido no login a cada 5 minutos.
- **Google Drive automático:** sincroniza no login, após alterações e a cada 5 minutos. Lançamentos, manutenções, vencimentos e preferências são salvos em `MotoristaConta-dados.json` na **sua** conta. Também anexa acessos em `MotoristaConta-acessos.json`. Exportar JSON/CSV no aparelho continua disponível.
- **Dashboard resumido:** mostra ganhos e km do dia, resultados mensais e anuais, progresso da meta e próximos vencimentos.
- **Lembretes:** contas do veículo com data, valor e status de pagamento, ordenadas por vencimento.
- **PWA:** instalável e usable offline depois do primeiro carregamento (app em cache + dados locais).

## Como rodar localmente

```bash
npm install
cp .env.example .env
# edite .env e coloque VITE_GOOGLE_CLIENT_ID
npm run dev
```

Abra o endereço que o Vite mostrar (em geral `http://localhost:5173`).
O servidor de desenvolvimento do Vite não executa funções da Vercel; para testar o contador localmente, use `npx vercel dev` com as variáveis do Supabase configuradas no ambiente local.

```bash
npm test
npm run build
npm run preview
```

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Sim, para login real | Client ID OAuth do tipo *Aplicativo da Web* |
| `VITE_DEV_BYPASS_AUTH` | Não | Só testes locais. `true` mostra “Entrar em modo de teste”. **Nunca** use isso em produção. |
| `SUPABASE_URL` | Sim, para o contador | URL do projeto Supabase; usada apenas pela função serverless |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim, para o contador | Chave secreta do Supabase; configure apenas no ambiente server-side, nunca no frontend |

Arquivo de exemplo: `.env.example` (contém apenas nomes e valores vazios; não coloque chaves secretas no frontend).

O login Google real **não dá para automatizar de ponta a ponta** neste repositório. A guarda de rota é coberta nos testes com sessão mockada no LocalStorage.

## Google Cloud (OAuth / GIS)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ou reutilize um).
3. **APIs e serviços → Tela de consentimento OAuth**. Tipo *Externo* (ou Interno, se for Workspace). Preencha nome do app: MotoristaConta.
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**. Tipo: **Aplicativo da Web**.
5. **APIs e serviços → Biblioteca → Google Drive API → Ativar.**
6. **Origens JavaScript autorizadas** (obrigatório):
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - a URL de produção na Vercel, por exemplo `https://seu-projeto.vercel.app`
7. Na tela de consentimento OAuth, adicione o escopo `https://www.googleapis.com/auth/drive.file` (arquivos criados pelo app). Enquanto o app estiver em *Testing*, cadastre os motoristas como usuários de teste.
8. Copie o **Client ID** para `.env` local e para as env vars da Vercel (`VITE_GOOGLE_CLIENT_ID`).

Sem Client ID o app ainda abre uma tela de login polida explicando a configuração.

## Deploy GitHub → Vercel

1. Crie um repositório no GitHub e envie este projeto (o usuário faz o `git` / push).
2. Em [Vercel](https://vercel.com): **Add New Project** → importe o repo.
3. Framework: Vite. Build: `npm run build`. Output: `dist`. A função em `api/` é implantada como backend serverless.
4. Em **Settings → Environment Variables** adicione `VITE_GOOGLE_CLIENT_ID`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Production e Preview). Mantenha a chave de serviço somente no ambiente server-side.
5. Deploy. O arquivo `vercel.json` reescreve as rotas do app para `index.html` (SPA); a rota da API é servida pela função serverless.
6. Copie a URL `https://….vercel.app` e cole nas **origens JavaScript autorizadas** do Client ID.

CLI (se você já estiver autenticado):

```bash
npx vercel
```

Se a CLI / conta Vercel não estiver logada, o projeto já está pronto: `vercel.json` + `.env.example`. Próximo passo: `npx vercel login` e depois `npx vercel`.

## Backup no Google Drive (automático)

1. Entre com Google. O navegador pede permissão para criar arquivos no Drive.
2. O app cria/atualiza `MotoristaConta-dados.json` (lançamentos, manutenções, vencimentos e preferências) e `MotoristaConta-acessos.json` (log de entrada).
3. Sincroniza após alterações locais, espera ~2 segundos para agrupar salvamentos e também verifica o Drive a cada 5 minutos.
4. Se o IndexedDB estiver vazio e o Drive tiver backup, restaura. Se os dois tiverem dados, a **Sincronização Inteligente** resolve qual versão prevalece.
5. Em **Configurações**: **Sincronizar agora** ou **Reconectar Drive** se o token expirar.

Cópia extra neste aparelho: **Exportar JSON** / **Exportar CSV** / **Importar JSON**.

Modo de teste (`VITE_DEV_BYPASS_AUTH`) **não** fala com o Drive.

## Sincronização Inteligente (Drive × Aparelho)

O app implementa sincronização bidirecional com **precedência pela versão mais recente**, garantindo que nenhum dado seja perdido.

### Campos de controle

| Campo | Descrição |
| --- | --- |
| `ultimaModificacao` | Data/hora da última alteração nos dados locais (salvar, editar ou excluir um lançamento ou manutenção). |
| `ultimaSincronizacao` | Data/hora da última troca bem-sucedida com o Google Drive. |
| `atualizadoEm` | Timestamp individual de cada registro (lançamento ou manutenção). |

### Lógica de precedência

Ao abrir o app, fazer login ou clicar **Sincronizar agora**:

1. Carrega `dadosLocal` (IndexedDB) e `dadosRemoto` (Google Drive).
2. Compara `ultimaModificacao` de cada fonte (`ultimaSincronizacao` como fallback).
3. A versão com **data/hora mais recente** é considerada a verdadeira e prevalece.
4. Essa versão é sincronizada para o outro lado (o mais antigo é atualizado).
5. Se forem iguais → sem ação.

### Mesclagem por registro

Quando ambos os lados possuem dados, a sincronização **não** substitui todo o arquivo — ela compara **cada registro individualmente**:

- Se o registro existe **só em um lado** → é incluído no resultado.
- Se existe **nos dois** com o mesmo `id` → prevalece o que tem `atualizadoEm` mais recente.
- Após mesclar → grava o resultado final **tanto no aparelho quanto no Drive**.

### Feedback visual

| Cor | Mensagem | Significado |
| --- | --- | --- |
| ⏳ Azul | *Sincronizando* | Comparando e aplicando alterações. |
| ⬆️ Azul | *Atualizado localmente* | Dados locais foram enviados ao Drive. |
| ⬇️ Violeta | *Atualizado pelo Drive* | Dados mais recentes da nuvem foram aplicados. |
| 🔄 Amarelo | *Dados mesclados* | Alterações dos dois lados foram combinadas. |
| ✅ Verde | *Ocioso · sincronizado* | Nenhuma sincronização está em andamento. |
| ⚠️ Vermelho | Mensagem de erro | Falha na conexão ou operação. |

## Dashboard, lembretes e seguro

O **Dashboard** resume ganhos e quilômetros de hoje, ganhos e gastos do mês (incluindo combustível e manutenções concluídas) e totais do ano. Em **Configurações**, defina a meta mensal de ganhos; o dashboard mostra o percentual concluído, o valor restante e a média necessária por dia restante no mês.

Em **Lembretes**, cadastre vencimentos de seguro, IPVA, licenciamento, parcelas, troca de óleo, revisão ou outros itens. Cada registro aceita título, tipo, valor, data, observação e status pendente/pago. Os alertas indicam quando vence, vence hoje ou há quantos dias está vencido. O dashboard lista os lembretes próximos e as próximas manutenções.

Em **Manutenção**, a categoria **🚗 Seguro** permite classificar o lançamento como mensalidade ou franquia. Essa categoria também aparece nos filtros e totais por categoria.

### Migração de backups existentes

Backups criados antes desta funcionalidade não possuem o campo `ultimaModificacao`. Para atualizá-los manualmente no Drive:

```bash
# Defina o token de acesso ao Google Drive e execute:
GOOGLE_DRIVE_TOKEN=<seu_token> npm run migrate-backup
```

O script busca `MotoristaConta-dados.json` no Drive, insere `ultimaModificacao = ultimaSincronizacao` quando ausente, e reenvia o arquivo atualizado.

> **Nota:** Na prática, o app já faz essa migração automaticamente na primeira abertura — o script é útil apenas para atualizar o arquivo no Drive sem abrir o aplicativo.

## Estrutura do JSON de backup

```json
{
  "version": 2,
  "app": "MotoristaConta",
  "exportedAt": "2026-10-14T16:00:00.000Z",
  "ultimaModificacao": "2026-10-14T20:15:00.000Z",
  "ultimaSincronizacao": "2026-10-14T20:16:00.000Z",
  "versaoSchema": 2,
  "settings": {
    "metaRsPorKm": 2.5,
    "reservaPercent": 15,
    "theme": "system",
    "alertaManutencaoDias": 30,
    "alertaManutencaoKm": 500,
    "metaMensal": 0
  },
  "registros": [
    {
      "id": "uuid",
      "data": "2026-10-14",
      "kmInicial": 1000,
      "kmFinal": 1120,
      "ganhos": { "uber": 220.5, "noventaenove": 80, "indrive": 40 },
      "combustivel": { "tipo": "gasolina", "valor": 70, "litros": 12 },
      "outrosGastos": 10,
      "observacoes": "Turno manhã",
      "atualizadoEm": "2026-10-14T20:15:00.000Z"
    }
  ],
  "manutencoes": [
    {
      "id": "uuid",
      "data": "2026-10-10",
      "categoria": "troca_oleo",
      "descricao": "Troca de óleo 5W-30 sintético",
      "valor": 180,
      "kmRealizacao": 50000,
      "status": "concluido",
      "criadoEm": "2026-10-10T14:00:00.000Z",
      "atualizadoEm": "2026-10-10T14:00:00.000Z"
    }
  ],
  "contasFixas": [
    {
      "id": "uuid",
      "titulo": "Seguro do carro",
      "tipo": "seguro",
      "valor": 250,
      "dataVencimento": "2026-10-25",
      "observacao": "Parcela mensal",
      "status": "pendente",
      "criadoEm": "2026-10-10T14:00:00.000Z",
      "atualizadoEm": "2026-10-10T14:00:00.000Z"
    }
  ]
}
```

CSV usa `;` (padrão pt-BR) e as mesmas colunas calculadas.

## Filtro de aplicativo

Em **Lançamentos** e **Dashboard**, o filtro Todas | Uber | 99 | Indrive muda os **ganhos** usados nos cartões, tabelas e gráficos. **KM e gastos** continuam os do dia inteiro (odômetro e combustível/outros não são separados por app). Há um texto de ajuda na interface.

## Dados e privacidade

- Sessão Google: `googleId`, nome, e-mail e último acesso no LocalStorage. O token do Drive fica só na memória.
- Lançamentos: IndexedDB, com cópia no Drive da conta logada.
- Preferências (meta, reserva, tema): LocalStorage + arquivo de backup no Drive.
- Sair no menu limpa a sessão local; os lançamentos permanecem neste navegador e no Drive.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS + Dexie.js + Recharts + Google Identity Services + PWA (vite-plugin-pwa).

## Painel administrativo, Supabase e assinaturas

### Supabase e autenticação

1. Configure o provedor Google em **Authentication → Providers** no Supabase e use o mesmo Google OAuth Client ID definido em `VITE_GOOGLE_CLIENT_ID`.
2. Execute `supabase/migrations/001_initial_setup.sql` no SQL Editor do projeto Supabase. A migração cria os perfis, planos, assinaturas, pagamentos, lembretes, notificações e políticas RLS.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente do frontend. A chave anon é pública e depende das políticas RLS; nunca coloque a service-role key em uma variável `VITE_*`.
4. Entre uma vez com a conta que será administradora e, no SQL Editor, promova o perfil:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@seudominio.com';
   ```

   A criação de novos perfis usa o papel `driver`. Não há cadastro público de administradores.

As tabelas remotas usam RLS e `auth.uid()` para limitar os registros ao usuário, com exceções explícitas para administradores. Os lançamentos e manutenções atuais continuam no IndexedDB e no Google Drive; o IndexedDB agora é separado por identidade Google. Na primeira abertura após a atualização, a base local legada só é copiada quando a identidade salva corresponde à identidade daquela base. A tabela remota `lancamentos` e `manutencao` já está protegida por RLS para integração cloud futura.

### Mercado Pago e notificações de cobrança

Configure no ambiente server-side da Vercel:

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | URL do projeto, usada pelas funções serverless |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada, exclusivamente server-side |
| `VITE_SUPABASE_ANON_KEY` | Chave pública usada para validar sessões nas APIs |
| `MERCADOPAGO_ACCESS_TOKEN` | Token privado para criar e consultar assinaturas |
| `MERCADOPAGO_WEBHOOK_SECRET` | Segredo para validar `x-signature` dos webhooks |
| `APP_URL` | URL pública do app usada no retorno do checkout |
| `CRON_SECRET` | Segredo enviado pela Vercel Cron para a régua diária |
| `RESEND_API_KEY` | Opcional; envio de e-mail de vencimento via Resend |

Cadastre `https://seu-dominio/api/webhook-mercadopago` como URL de webhook no Mercado Pago e habilite eventos de pagamentos e assinaturas (preapproval). A API valida a assinatura HMAC antes de consultar o recurso diretamente no Mercado Pago. O job `/api/billing-cron` roda diariamente pela configuração em `vercel.json`, envia avisos in-app, suspende assinaturas após a tolerância e processa lembretes recorrentes. Para e-mail, configure a `RESEND_API_KEY` e o remetente verificado em **Admin → Configurações** (ou `EMAIL_FROM` no servidor).

Configure `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `APP_URL` e `CRON_SECRET` nas variáveis da Vercel. `RESEND_API_KEY` e `EMAIL_FROM` são opcionais. Não cadastre chaves privadas com prefixo `VITE_`.

O painel fica em `/admin` e exige papel `admin` no perfil Supabase. O checkout e o webhook não são simulados quando as credenciais do Mercado Pago estão ausentes; nesse caso, o endpoint retorna erro explícito e o restante do app local continua disponível.
