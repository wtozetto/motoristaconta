# MotoristaConta | ContaRota

SPA estática para motoristas de Uber, 99 e Indrive acompanharem ganhos, km, gastos e lucro.

- **100% no navegador.** IndexedDB (Dexie) + LocalStorage. Sem backend, sem funções serverless, sem banco remoto.
- **Google Drive automático:** no login o app pede permissão `drive.file` e grava `MotoristaConta-dados.json` na **sua** conta. Também anexa acessos em `MotoristaConta-acessos.json`. Exportar JSON/CSV no aparelho continua disponível.
- **PWA:** instalável e usable offline depois do primeiro carregamento (app em cache + dados locais).

## Como rodar localmente

```bash
npm install
cp .env.example .env
# edite .env e coloque VITE_GOOGLE_CLIENT_ID
npm run dev
```

Abra o endereço que o Vite mostrar (em geral `http://localhost:5173`).

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

Arquivo de exemplo: `.env.example` (somente `VITE_GOOGLE_CLIENT_ID`).

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

## Deploy GitHub → Vercel (estático)

1. Crie um repositório no GitHub e envie este projeto (o usuário faz o `git` / push).
2. Em [Vercel](https://vercel.com): **Add New Project** → importe o repo.
3. Framework: Vite. Build: `npm run build`. Output: `dist`.
4. Em **Settings → Environment Variables** adicione `VITE_GOOGLE_CLIENT_ID` (Production e Preview).
5. Deploy. O arquivo `vercel.json` reescreve todas as rotas para `index.html` (SPA).
6. Copie a URL `https://….vercel.app` e cole nas **origens JavaScript autorizadas** do Client ID.

CLI (se você já estiver autenticado):

```bash
npx vercel
```

Se a CLI / conta Vercel não estiver logada, o projeto já está pronto: `vercel.json` + `.env.example`. Próximo passo: `npx vercel login` e depois `npx vercel`.

## Backup no Google Drive (automático)

1. Entre com Google. O navegador pede permissão para criar arquivos no Drive.
2. O app cria/atualiza `MotoristaConta-dados.json` (lançamentos + preferências) e `MotoristaConta-acessos.json` (log de entrada).
3. Depois de cada salvamento, espera ~2 segundos e envia de novo.
4. Se o IndexedDB estiver vazio e o Drive tiver backup, restaura. Se os dois tiverem dados, o conjunto mais recente (`atualizadoEm` / `exportedAt`) vence; registros são mesclados por `id`.
5. Em **Configurações**: **Sincronizar agora** ou **Reconectar Drive** se o token expirar.

Cópia extra neste aparelho: **Exportar JSON** / **Exportar CSV** / **Importar JSON**.

Modo de teste (`VITE_DEV_BYPASS_AUTH`) **não** fala com o Drive.

## Estrutura do JSON de backup

```json
{
  "version": 1,
  "app": "MotoristaConta",
  "exportedAt": "2026-10-14T16:00:00.000Z",
  "settings": {
    "metaRsPorKm": 2.5,
    "reservaPercent": 15,
    "theme": "system"
  },
  "registros": [
    {
      "id": "uuid",
      "data": "2026-10-14",
      "kmInicial": 1000,
      "kmFinal": 1120,
      "ganhos": { "uber": 220.5, "noventaenove": 80, "indrive": 40 },
      "combustivel": 70,
      "outrosGastos": 10,
      "observacoes": "Turno manhã",
      "atualizadoEm": "2026-10-14T20:15:00.000Z"
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
