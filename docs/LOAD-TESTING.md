# Testar escala — 100 escolas simultâneas

Objetivo: ter **confiança medida** de que o sistema aguenta ~100 escolas
registrando entradas/saídas e reconhecimentos ao mesmo tempo, sem erro.

O teste é feito em **duas camadas** — a maioria dos erros mora na primeira.

---

## Camada A — Corretude sob concorrência (roda local, rápido)

Valida as invariantes que "dão erro feio" quando muita coisa acontece junta:
cota que fura o teto, presença duplicada, dados vazando entre escolas.

Pré-requisito: o Postgres de teste no Docker (porta 5544) e, para o teste de
dedup, o dev server na 3010 (ver seção do dev server abaixo).

```bash
# invariantes de corrida direto no banco de teste
DATABASE_URL=postgresql://postgres:testpass@localhost:5544/safedoor_test \
BASE=http://localhost:3010 \
npx tsx tests/concurrency.test.ts
```

O que ele prova:
- **A.** 300 reservas de cota concorrentes num teto de 50 → exatamente 50 passam
  e o contador para em 50 (nunca fura, nunca conta a menos).
- **A2.** 200 reservas no modo ilimitado → contador = 200 (não perde contagem).
- **B.** Reservas de 2 escolas intercaladas → cada contador bate só o seu
  (isolamento multi-tenant).
- **C.** 20 check-ins idênticos simultâneos → 1 evento só (dedup segura).

Também rode os testes de unidade e o smoke a cada mudança:

```bash
npx tsx tests/logic.test.ts        # timezone, regras, MRR, impersonação
npx tsx tests/async-pool.test.ts   # teto de concorrência dos crons
bash tests/smoke.sh                # 121 asserções ponta a ponta
```

---

## Camada B — Throughput e latência reais (precisa de STAGING)

Mede se a **infra** escala: latência p95/p99, taxa de erro e comportamento sob
carga crescente. Não dá para simular fielmente no seu Mac — serverless escala
diferente. Use um deploy de staging.

> ⚠️ **NUNCA rode carga contra produção.** Suba um projeto/branch de staging na
> Vercel com um **banco separado** (um branch do Neon serve). Carga contra o
> banco de produção corrompe métricas e pode derrubar clientes reais.

### 1. Instale o k6

```bash
brew install k6      # macOS
```

### 2. Prepare o staging

- Deploy de staging na Vercel (ex.: um branch, ou um projeto `porta-segura-staging`).
- `DATABASE_URL` do staging apontando para um **branch/instância separada** do Neon.
- Região `gru1` (mesma de produção) para a medição ser representativa.
- **Rekognition:** para medir o caminho real de reconhecimento, use uma conta/
  coleção de teste. Para medir só o registro de presença (endpoint quente), o
  script já usa `/api/events/checkin-checkout`, que não chama a AWS.

### 3. Semeie os dados de carga

Cria 100 escolas × 30 alunos × 2 dispositivos e gera `tests/load/load-fixtures.json`:

```bash
DATABASE_URL="<URL_DO_STAGING>" \
SCHOOLS=100 STUDENTS_PER_SCHOOL=30 DEVICES_PER_SCHOOL=2 \
npx tsx tests/load/seed-load.ts
```

As escolas nascem com nome `LOADTEST …` para limpar fácil depois (ver seção 6).

### 4. Rode o teste de carga

```bash
BASE_URL="https://staging.seuapp.vercel.app" \
k6 run --env FIXTURES=tests/load/load-fixtures.json tests/load/recognize.k6.js
```

Degraus: ~10 → ~50 → ~100 escolas, sustenta o pico 1 min, desaquece.

### 5. Leia o resultado

O k6 aprova/reprova pelos `thresholds` do script:

| Métrica | Meta padrão | Se estourar, olhe… |
|---|---|---|
| `http_req_duration` p95 | < 800 ms | Neon (CPU/conexões), N+1 de query, região da função |
| `http_req_duration` p99 | < 1500 ms | cold starts, contenção no banco |
| `errors` (rate) | < 1% | 5xx nos logs da Vercel; timeouts de função |
| 429/409 | — | **não são erro**: são cota/cooldown funcionando |

Suba os VUs no script (`options.stages`) para achar o ponto de ruptura.

### 6. Limpe o staging

Algumas FKs (SchoolSettings, Class, Student, Device) não têm `onDelete: Cascade`,
então apague os dependentes antes da escola:

```sql
-- no banco de staging
DO $$
DECLARE ids text[];
BEGIN
  SELECT array_agg(id) INTO ids FROM "School" WHERE name LIKE 'LOADTEST %';
  IF ids IS NULL THEN RETURN; END IF;
  DELETE FROM "AttendanceEvent" WHERE "studentId" IN (SELECT id FROM "Student" WHERE "schoolId" = ANY(ids));
  DELETE FROM "Student"          WHERE "schoolId" = ANY(ids);
  DELETE FROM "Device"           WHERE "schoolId" = ANY(ids);
  DELETE FROM "Class"            WHERE "schoolId" = ANY(ids);
  DELETE FROM "SchoolSettings"   WHERE "schoolId" = ANY(ids);
  DELETE FROM "Subscription"     WHERE "schoolId" = ANY(ids);
  DELETE FROM "RecognitionUsage" WHERE "schoolId" = ANY(ids);
  DELETE FROM "CronRun"          WHERE "schoolId" = ANY(ids);
  DELETE FROM "School"           WHERE id = ANY(ids);
END $$;
```

### Validar o harness localmente antes do staging

Prova a carga HTTP sustentada contra o dev server (sem k6), útil para caçar 5xx
antes de gastar com staging:

```bash
# 1) dev server na 3010 (ver seção do dev server)
# 2) semeia poucas escolas no banco de TESTE e gera fixtures
DATABASE_URL="postgresql://postgres:testpass@localhost:5544/safedoor_test" \
SCHOOLS=5 STUDENTS_PER_SCHOOL=10 npx tsx tests/load/seed-load.ts
# 3) dispara carga em degraus (conc 10→25→50→100) e mede p50/p95/p99 + 5xx
BASE=http://localhost:3010 npx tsx tests/load/local-load.ts
# 4) limpe (mesmo bloco DO da seção 6, no banco de teste)
```

---

## O que já foi endurecido no código para escala

Aplicado nos commits desta série (ver o PR):

- **Cache do gate de reconhecimento (30s/escola):** a checagem de pausa/cota/
  minConfidence deixou de bater 3 tabelas por frame. Com 100 escolas isso
  derrubava centenas de queries/segundo. A **reserva** continua atômica e
  por-frame (nunca fura o teto). `lib/recognition-usage.ts`.
- **Retry/backoff no throttling da AWS:** `SearchFacesByImage` tenta de novo em
  `ThrottlingException`/`ProvisionedThroughputExceededException` antes de
  desistir. `lib/rekognition.ts`.
- **Reserva de cota em 1 escrita** no caminho comum (era 2). `lib/recognition-usage.ts`.
- **Crons paralelos com teto de concorrência:** `absence-alerts` e `daily-digest`
  processam escolas em paralelo (limite 8) em vez de uma de cada vez, para não
  estourar o timeout da função com 100 escolas. `lib/async-pool.ts`.

## Limites externos a conferir ANTES do pico

- **AWS Rekognition TPS:** o limite padrão de `SearchFacesByImage` (~50 req/s por
  conta, varia por região) pode ser o teto real. Peça aumento no console da AWS
  e monitore `ThrottlingException`.
- **Neon:** dimensione o compute e confirme o pooler. O driver já usa
  `poolQueryViaFetch` (não estoura conexões em serverless).
- **Vercel:** confira o limite de concorrência de funções do seu plano.
- **Custo:** cada `SearchFacesByImage` é cobrado. 100 escolas × frames a cada 2s
  é volume alto — o gate de cota por plano existe justamente para limitar isso.

## Dev server local (para a Camada A)

```bash
DATABASE_URL="postgresql://postgres:testpass@localhost:5544/safedoor_test" \
CRON_SECRET="cron-test-secret" AGENT_API_SECRET="test-agent-secret" \
NEXTAUTH_SECRET="dev-secret" NEXTAUTH_URL="http://localhost:3010" \
npx next dev -p 3010
```

> Não rode `next build` com o dev server no ar — corrompe o `.next` e a suíte
> falha em massa com falsos 500.
