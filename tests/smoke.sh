#!/bin/bash
# Smoke test contra o servidor local (porta 3010) + banco Postgres de teste.
# Uso: bash tests/smoke.sh
set -u
BASE="http://localhost:3010"
KEY_A="test-device-key-escola-a"
TODAY="2026-08-24"

sql0() { docker exec safedoor-test-db psql -U postgres -d safedoor_test -tAc "$1"; }
JOAO=$(sql0 "SELECT id FROM \"Student\" WHERE name LIKE 'João%'")
MARIA=$(sql0 "SELECT id FROM \"Student\" WHERE name LIKE 'Maria%'")
PEDRO=$(sql0 "SELECT id FROM \"Student\" WHERE name LIKE 'Pedro%'")
DEVICE_A=$(sql0 "SELECT id FROM \"Device\" WHERE \"apiKey\"='$KEY_A'")

PASS=0; FAIL=0
check() { # check <desc> <expectativa> <resultado>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1"
  else FAIL=$((FAIL+1)); echo "  ✗ $1  (esperado: $2 | obtido: $3)"; fi
}

post_event() { # post_event <json> [headers extras...]
  local json="$1"; shift
  curl -s -w '\n%{http_code}' -X POST "$BASE/api/events/checkin-checkout" \
    -H "Content-Type: application/json" "$@" -d "$json"
}

sql() { docker exec safedoor-test-db psql -U postgres -d safedoor_test -tAc "$1"; }

echo "── Agente: entrada pontual, atraso, dedup ──"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"ENTRY\",\"confidence\":0.97,\"timestamp\":\"${TODAY}T07:20:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "João entrada 07:20 BRT → 201" "201" "$(echo "$R" | tail -1)"
NOTES=$(sql "SELECT COALESCE(notes,'NULL') FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='ENTRY'")
check "João 07:20 é pontual (notes NULL, não ATRASO)" "NULL" "$NOTES"
DAYKEY=$(sql "SELECT \"dayKey\" FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='ENTRY'")
check "dayKey no dia local correto" "$TODAY" "$DAYKEY"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"ENTRY\",\"confidence\":0.97,\"timestamp\":\"${TODAY}T07:25:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "João 2ª entrada → skipped (dedup)" "true" "$(echo "$R" | head -1 | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("skipped")).lower())')"

R=$(post_event "{\"studentId\":\"$MARIA\",\"eventType\":\"ENTRY\",\"confidence\":0.95,\"timestamp\":\"${TODAY}T07:45:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "Maria entrada 07:45 → 201" "201" "$(echo "$R" | tail -1)"
NOTES=$(sql "SELECT notes FROM \"AttendanceEvent\" WHERE \"studentId\"='$MARIA' AND \"eventType\"='ENTRY'")
check "Maria 07:45 (turno MANHA, limite 07:30) = ATRASO" "ATRASO" "$NOTES"

echo "── Agente: saída antecipada, avanço de horário, regressão bloqueada ──"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"EXIT\",\"confidence\":0.96,\"timestamp\":\"${TODAY}T11:30:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "João saída 11:30 → 201" "201" "$(echo "$R" | tail -1)"
NOTES=$(sql "SELECT notes FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='EXIT'")
check "Saída 11:30 (antes de 12:00) = SAIDA_ANTECIPADA" "SAIDA_ANTECIPADA" "$NOTES"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"EXIT\",\"confidence\":0.96,\"timestamp\":\"${TODAY}T12:05:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "João nova saída 12:05 → 200 (atualiza)" "200" "$(echo "$R" | tail -1)"
NOTES=$(sql "SELECT COALESCE(notes,'NULL') FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='EXIT'")
check "Nota recomputada: 12:05 não é mais antecipada" "NULL" "$NOTES"
TS=$(sql "SELECT to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','HH24:MI') FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='EXIT'")
check "Horário da saída avançou para 12:05" "12:05" "$TS"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"EXIT\",\"confidence\":0.96,\"timestamp\":\"${TODAY}T11:00:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "Saída retroativa 11:00 → skipped (não regride)" "true" "$(echo "$R" | head -1 | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("skipped")).lower())')"
TS=$(sql "SELECT to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo','HH24:MI') FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"eventType\"='EXIT'")
check "Horário permaneceu 12:05" "12:05" "$TS"

echo "── Segurança: tenant, auth, confiança ──"

R=$(post_event "{\"studentId\":\"$PEDRO\",\"eventType\":\"ENTRY\",\"confidence\":0.97,\"timestamp\":\"${TODAY}T07:20:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "Aluno da Escola B com chave da Escola A → 404" "404" "$(echo "$R" | tail -1)"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"ENTRY\",\"confidence\":0.97}" -H "x-agent-secret: test-agent-secret")
check "Segredo legado SEM deviceId → 401" "401" "$(echo "$R" | tail -1)"

R=$(post_event "{\"studentId\":\"$MARIA\",\"eventType\":\"EXIT\",\"deviceId\":\"$DEVICE_A\",\"confidence\":0.95,\"timestamp\":\"${TODAY}T12:10:00-03:00\"}" -H "x-agent-secret: test-agent-secret")
check "Segredo legado COM deviceId válido → 201" "201" "$(echo "$R" | tail -1)"

R=$(post_event "{\"studentId\":\"$MARIA\",\"eventType\":\"ENTRY\",\"confidence\":0.70,\"timestamp\":\"${TODAY}T08:00:00-03:00\"}" -H "x-device-api-key: $KEY_A")
check "Confiança 70% < minConfidence 90% → 422" "422" "$(echo "$R" | tail -1)"

R=$(post_event "{\"studentId\":\"$JOAO\",\"eventType\":\"ENTRY\",\"confidence\":0.97}")
check "Sem nenhuma credencial → 401" "401" "$(echo "$R" | tail -1)"

echo "── Webhook de pagamentos ──"

WH='{"id":"evt_teste_001","type":"payment.confirmed","status":"paid","amount":49700,"email":"admin@teste.com"}'
R=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/webhooks/payments" -H "Content-Type: application/json" -d "$WH")
check "Webhook SEM header (segredo configurado) → 401" "401" "$(echo "$R" | tail -1)"

R=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/webhooks/payments" -H "Content-Type: application/json" -H "x-webhook-secret: whsec_test_123" -d "$WH")
check "Webhook COM segredo → 200" "200" "$(echo "$R" | tail -1)"
INV=$(sql "SELECT status||':'||amount FROM \"Invoice\" LIMIT 1")
check "Fatura criada como PAID no valor certo" "PAID:49700" "$INV"

R=$(curl -s -X POST "$BASE/api/webhooks/payments" -H "Content-Type: application/json" -H "x-webhook-secret: whsec_test_123" -d "$WH")
check "Replay do mesmo externalId → duplicate" "true" "$(echo "$R" | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("duplicate")).lower())')"
INVCOUNT=$(sql "SELECT count(*) FROM \"Invoice\"")
check "Replay não criou 2ª fatura" "1" "$INVCOUNT"

echo "── Relatório diário autenticado (NextAuth) ──"

JAR=$(mktemp)
CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | python3 -c 'import json,sys; print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=admin@teste.com" \
  --data-urlencode "password=senha12345" \
  --data-urlencode "json=true" > /dev/null

DAILY=$(curl -s -b "$JAR" "$BASE/api/reports/daily?date=$TODAY")
check "João no relatório = left (entrou e saiu)" "left" "$(echo "$DAILY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(s['status'] for s in d['students'] if s['name'].startswith('João')))")"
check "Maria no relatório = left (entrada + saída via legado)" "left" "$(echo "$DAILY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(s['status'] for s in d['students'] if s['name'].startswith('Maria')))")"
check "Nota de atraso da Maria visível no relatório" "ATRASO" "$(echo "$DAILY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(s['entryNotes'] for s in d['students'] if s['name'].startswith('Maria')))")"

R=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/reports/daily?date=$TODAY")
check "Relatório sem sessão → 401" "401" "$R"

echo
echo "RESULTADO: $PASS passaram, $FAIL falharam"
[ "$FAIL" -eq 0 ]
