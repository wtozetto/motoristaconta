# MotoristaConta — Relatório de correções

## Verificação inicial (antes de alterar)

- `npm run build` (`tsc -b && vite build`): **OK**, sem erros de TypeScript.
- `npm test` (vitest): **56/56 testes passando**.
- `npm run lint` (oxlint): **0 erros**, 8 avisos de estilo React (não bloqueantes).

Ou seja: o projeto compilava e testava, mas havia **bugs de lógica, de preservação de
dados e de robustez de importação** que não eram cobertos pelos testes.

## Como aplicar este pacote

No clone do repositório:

```bash
git apply motoristaconta-correcoes.patch   # ou: git apply --whitespace=fix ...
npm install
npm run build
npm test
```

Alternativa: use `motoristaconta-src-corrigido.zip` (código-fonte já com as correções,
sem `node_modules`, `dist` e `.git`).

## Correções aplicadas

### 1. Importar JSON podia perder dados na sincronização com o Drive (risco de perda)
- **Onde:** `src/data/DataContext.tsx`, `src/theme/ThemeContext.tsx`
- **Problema:** `importRegistros` / `importManutencoes` e alterações de configuração
  não atualizavam o carimbo `ultimaModificacao`. Na sincronização seguinte, o Drive
  com carimbo mais recente era considerado "verdadeiro" e os dados recém-importados
  eram substituídos.
- **Correção:** importações e mudanças de agora passam a gravar o carimbo local com a
  data/hora atual; a próxima sincronização sobe os dados corretamente.

### 2. QuickEdit do Dashboard perdia abastecimentos e não validava (perda de dados + erro silencioso)
- **Onde:** `src/pages/DashboardPage.tsx`
- **Problemas:**
  - Ao editar pelo formulário rápido, a lista de abastecimentos era substituída por
    apenas um item; abastecimentos extras e o valor total do combustível eram perdidos.
  - Não chamava `validateRegistro`; KM inválido/negativo chegava ao contexto e a falha
    de validação virava rejeição de promessa sem mensagem na tela.
- **Correção:** os demais abastecimentos são preservados (apenas o primeiro é editado),
  o agregado é recalculado, há validação com lista de erros visível, botão com estado
  "Salvando…" e tratamento de erro no `onSave`.

### 3. KM atual ignorava manutenções quando havia lançamentos
- **Onde:** `src/lib/maintenance.ts` (`getKmAtual`)
- **Problema:** se existia qualquer lançamento, o KM das manutenções (ex.: serviço
  feito acima do odômetro do último dia) era ignorado; alertas por KM podiam travar
  em valor antigo.
- **Correção:** o KM atual é o maior valor entre KM final dos lançamentos e KM de
  realização das manutenções.
- **Teste:** `src/lib/maintenance.test.ts`.

### 4. Preço médio do combustível contaminado por itens sem litragem
- **Onde:** `src/lib/fuel.ts` (`calculateCombustivelMetrics`)
- **Problema:** `precoMedio = valor / litros` usava o valor total (incluindo
  abastecimentos apenas com valor, sem litros), distorcendo o preço por litro.
- **Correção:** o preço médio usa somente valores de abastecimentos que informaram
  litros; o total geral continua somando todos os valores.
- **Teste:** `src/lib/fuel.test.ts`.

### 5. "Total investido" em manutenção contava itens programados (orçamento futuro)
- **Onde:** `src/lib/maintenance.ts` (`calculateManutencaoMetrics`)
- **Problema:** serviços com status `programado` entravam no total gasto, inflando o
  valor realizado.
- **Correção:** apenas `concluido` soma em `totalGasto` e por categoria; a contagem de
  itens continua incluindo todos os registros.

### 6. JSON de backup malformado quebrava a importação
- **Onde:** `src/lib/backup.ts` (`parseBackupJson`, `normalizeRegistro`, `normalizeManutencao`)
- **Problemas:**
  - `ganhos: null` ou objeto quebrado causava `TypeError` ao importar.
  - Campos numéricos texto/`NaN` (KM, valores, litros, gastos) eram aceitos como `NaN`.
  - Configurações inválidas (reserva negativa acima de 100%, tema desconhecido, meta
    negativa) eram persistidas sem sanização.
- **Correção:** leitura defensiva com fallbacks a zero/zeros, clamp de reserva
  (0–100), meta não negativa, tema reconhecido com fallback `system` e alertas com
  valores mínimos válidos.
- **Testes:** novos casos em `src/lib/backup.test.ts`.

### 7. Filtro de aplicativo não refletia nos gráficos de participação
- **Onde:** `src/components/DashboardCharts.tsx`
- **Problema:** o README diz que o filtro muda ganhos dos cartões, tabelas e gráficos,
  mas o donut/barras de participação sempre mostravam os três aplicativos.
- **Correção:** com um app selecionado, os gráficos mostram apenas aquele aplicativo.

### 8. Decodificador de credencial JWT quebrava base64 sem padding
- **Onde:** `src/auth/session.ts` (`decodeJwtPayload`)
- **Problema:** JWT usa base64url sem `=`; `atob` pode rejeitar padding ausente.
- **Correção:** padding reconstruído e erro amigável em credencial inválida.
- **Teste:** `src/auth/session.test.tsx`.

### 9. Configurações da tela de Configurações aceitavam valores inválidos
- **Onde:** `src/pages/ConfigPage.tsx`
- **Correção:** meta R$/km e reserva (%) são clampeadas/validadas ao digitar
  (reserva entre 0 e 100; meta não negativa).

### 10. Repo sem `.env.example` referenciado no README; `.gitignore` ignorava o exemplo
- **Onde:** `.env.example` (novo), `.gitignore`
- **Problema:** o README manda copiar `.env.example`, mas o arquivo não existia e o
  `.gitignore` (regra `.env*` no final) também ignoraria o exemplo versionado.
- **Correção:** `.env.example` criado com `VITE_GOOGLE_CLIENT_ID=` e comentários;
  ordem do `.gitignore` corrigida para manter `!.env.example`.

### 11. Meta padrão alinhada à documentação
- **Onde:** `src/types.ts` (`DEFAULT_SETTINGS.metaRsPorKm`)
- **Correção:** padrão `2.5` (conforme exemplo do README), em vez de `0`.

## Verificação final

- `npm run build`: OK.
- `npm test`: **67/67 testes passando** (eram 56; +11 de cobertura das correções).
- `npm run lint`: 0 erros (os 8 avisos restantes são os mesmos de estilo React do
  projeto original, em `set-state-in-effect`/`purity`/fast-refresh).

## Sugestões não implementadas (não eram bugs bloqueantes)

1. Bundle JS com ~888 kB (aviso de chunk > 500 kB no build): considerar code-splitting
   por rota (`React.lazy`) e mover Recharts para carregamento sob demanda.
2. `ConfirmDialog` não fecha com tecla Escape e não tem trap de foco (melhoria de
   acessibilidade).
3. `findFileByName` usa apenas o primeiro arquivo com o mesmo nome; se surgirem
   duplicatas no Drive, vale deduplicar por nome ao sincronizar.
4. Os 8 avisos de lint do React podem ser resolvidos substituindo `setState` em efeitos
   por derivação de valor/render init (não alteram comportamento).
