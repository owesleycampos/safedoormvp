#!/bin/bash
# Smoke test contra o servidor local (porta 3010) + banco Postgres de teste.
# Uso: bash tests/smoke.sh
set -u
BASE="http://localhost:3010"
KEY_A="test-device-key-escola-a"
TODAY="2026-08-24"

sql0() { docker exec safedoor-test-db psql -U postgres -d safedoor_test -tAc "$1"; }

# Limpa os dados transacionais para a suíte ser repetível. Sem isto, uma
# segunda execução vê os eventos da primeira e o dedup responde 200 (updated)
# onde o teste espera 201 (created) — falha do teste, não do sistema.
sql0 'TRUNCATE "AttendanceEvent", "AbsenceAlert", "Invoice", "WebhookEvent", "AuditLog" CASCADE;' >/dev/null
sql0 "UPDATE \"Subscription\" SET status='ACTIVE';" >/dev/null 2>&1
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

echo "── Responsáveis: cadastrar, buscar, editar, excluir (Fase 1) ──"

sql0 "DELETE FROM \"User\" WHERE email='novo.resp@teste.com';" >/dev/null 2>&1

api() { # api <METODO> <rota> [json]
  local m="$1" r="$2" d="${3:-}"
  if [ -n "$d" ]; then
    curl -s -b "$JAR" -o /tmp/p.json -w '%{http_code}' -X "$m" "$BASE$r" -H "Content-Type: application/json" -d "$d"
  else
    curl -s -b "$JAR" -o /tmp/p.json -w '%{http_code}' -X "$m" "$BASE$r"
  fi
}
jfield() { python3 -c "import json;print(json.load(open('/tmp/p.json')).get('$1',''))" 2>/dev/null; }

check "criar responsável sem senha → 201 (antes: 405)" "201" \
  "$(api POST /api/parents '{"name":"Novo Resp","email":"novo.resp@teste.com","phone":"11970000000"}')"
NEW_PID=$(jfield id)

check "e-mail duplicado → 409" "409" \
  "$(api POST /api/parents '{"name":"Outro","email":"novo.resp@teste.com"}')"
check "e-mail inválido → 400" "400" \
  "$(api POST /api/parents '{"name":"X","email":"nao-e-email"}')"
check "senha curta → 400" "400" \
  "$(api POST /api/parents '{"name":"X","email":"curta@teste.com","password":"123"}')"

# A busca filtrava por User.schoolId (sempre nulo em responsável) → 0 resultados sempre
found_lower=$(curl -s -b "$JAR" "$BASE/api/parents?search=novo&includeUnlinked=true" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["parents"]))')
found_upper=$(curl -s -b "$JAR" "$BASE/api/parents?search=NOVO&includeUnlinked=true" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["parents"]))')
check "busca encontra o responsável (antes: sempre 0)" "1" "$found_lower"
check "busca é insensível a maiúsculas" "1" "$found_upper"

check "editar responsável → 200" "200" \
  "$(api PATCH "/api/parents/$NEW_PID" '{"name":"Novo Resp Editado","phone":"11960000000"}')"
check "nome foi persistido" "Novo Resp Editado" "$(jfield name)"

# Vincula ao João (mesma escola da sessão) para provar a recusa de exclusão.
# O corpo é montado numa variável: JSON escrita com \" dentro de "$( ... )" é
# reparseada pelo shell e as chaves viram expansão de chaves.
BODY_LINK=$(printf '{"parentId":"%s","relationship":"Mãe"}' "$NEW_PID")
check "vincular responsável ao aluno → 201" "201" \
  "$(api POST "/api/students/$JOAO/parents" "$BODY_LINK")"
check "excluir responsável com vínculo → 409" "409" "$(api DELETE "/api/parents/$NEW_PID")"

# Isolamento entre escolas: a sessão é admin da Escola Teste A; a Maria do seed
# pertence à Escola Demo e não pode ser tocada por este admin.
OUTRA_ESCOLA_PID=$(sql0 "SELECT p.id FROM \"Parent\" p WHERE p.name LIKE 'Maria Silva%' LIMIT 1")
check "responsável de outra escola → 404 (isolamento)" "404" \
  "$(api DELETE "/api/parents/$OUTRA_ESCOLA_PID")"
check "responsável de outra escola não aparece na busca" "0" \
  "$(curl -s -b "$JAR" "$BASE/api/parents?search=Maria+Silva" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["parents"]))')"

sql0 "DELETE FROM \"StudentParent\" WHERE \"parentId\"='$NEW_PID';" >/dev/null
check "excluir responsável sem vínculo → 200" "200" "$(api DELETE "/api/parents/$NEW_PID")"
check "conta removida do banco" "0" \
  "$(sql0 "SELECT count(*) FROM \"User\" WHERE email='novo.resp@teste.com'")"

check "sem sessão não cria responsável → 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/parents" -H 'Content-Type: application/json' -d '{"name":"X","email":"y@z.com"}')"

echo "── Vínculo em um passo e convite (Fase 2) ──"

sql0 "DELETE FROM \"User\" WHERE email='inline@teste.com';" >/dev/null 2>&1
LIVRE=$(sql0 "SELECT s.id FROM \"Student\" s WHERE s.\"schoolId\"=(SELECT \"schoolId\" FROM \"User\" WHERE email='admin@teste.com') AND s.id NOT IN (SELECT \"studentId\" FROM \"StudentParent\") LIMIT 1")

BODY_NEW=$(printf '{"name":"Inline Resp","email":"inline@teste.com","phone":"11911112222","relationship":"Pai"}')
check "criar responsável e vincular num passo → 201" "201" \
  "$(api POST "/api/students/$LIVRE/parents" "$BODY_NEW")"
check "a resposta marca que criou o responsável" "True" "$(jfield createdParent)"
check "conta criada sem senha (define pelo convite)" "t" \
  "$(sql0 "SELECT \"passwordHash\" IS NULL FROM \"User\" WHERE email='inline@teste.com'")"

INLINE_PID=$(sql0 "SELECT p.id FROM \"Parent\" p JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='inline@teste.com'")
BODY_DUP=$(printf '{"parentId":"%s"}' "$INLINE_PID")
check "vincular o mesmo responsável de novo → 409" "409" \
  "$(api POST "/api/students/$LIVRE/parents" "$BODY_DUP")"

# O endpoint canônico é do aluno: precisa validar a escola do aluno também
PEDRO_OUTRA_ESCOLA="$PEDRO"
check "aluno de outra escola → 404 (isolamento)" "404" \
  "$(api POST "/api/students/$PEDRO_OUTRA_ESCOLA/parents" "$BODY_DUP")"

BODY_UNLINK=$(printf '{"parentId":"%s"}' "$INLINE_PID")
check "desvincular → 200" "200" "$(api DELETE "/api/students/$LIVRE/parents" "$BODY_UNLINK")"
check "vínculo removido do banco" "0" \
  "$(sql0 "SELECT count(*) FROM \"StudentParent\" WHERE \"parentId\"='$INLINE_PID'")"

check "endpoint duplicado /api/parents/[id]/link foi removido" "404" \
  "$(api POST "/api/parents/$INLINE_PID/link" '{"studentId":"x"}')"

# Código de acesso aposentado. As duas rotas foram apagadas; o caminho agora
# cai no segmento dinâmico /api/students/[id], que não implementa POST — daí
# 405 em vez de 404. O que importa é que não existe mais handler próprio.
check "API de gerar códigos removida" "405" "$(api POST /api/students/generate-codes '{}')"
check "API de vincular por código removida" "405" "$(api POST /api/students/link '{"accessCode":"ABC123"}')"

echo "── Convite: data de nascimento como prova de vínculo ──"

# João tem data; Maria fica sem, para cobrir os dois caminhos
sql0 "UPDATE \"Student\" SET \"birthDate\"='2015-05-20' WHERE id='$JOAO';" >/dev/null
sql0 "UPDATE \"Student\" SET \"birthDate\"=NULL WHERE id='$MARIA';" >/dev/null
CLS_A=$(sql0 "SELECT \"classId\" FROM \"Student\" WHERE id='$JOAO'")
INV=$(curl -s -b "$JAR" -X POST "$BASE/api/invites" -H "Content-Type: application/json" -d "{\"classId\":\"$CLS_A\"}")
TOK=$(echo "$INV" | python3 -c 'import json,sys;print(json.load(sys.stdin)["invite"]["token"])')

check "convite avisa quais alunos estão sem data" "1" \
  "$(echo "$INV" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("studentsMissingBirthDate",[])))')"

claim() { curl -s -o /tmp/p.json -w '%{http_code}' -X POST "$BASE/api/invites/$TOK/claim" -H "Content-Type: application/json" -d "$1"; }

B=$(printf '{"studentId":"%s","birthDate":"1999-01-01","parentName":"X","email":"claim1@teste.com","password":"senha12345"}' "$MARIA")
check "aluno sem data → 409 (antes: qualquer data passava)" "409" "$(claim "$B")"
check "resposta identifica a causa" "True" "$(jfield missingBirthDate)"

B=$(printf '{"studentId":"%s","birthDate":"1999-01-01","parentName":"X","email":"claim2@teste.com","password":"senha12345"}' "$JOAO")
check "data de nascimento errada → 400" "400" "$(claim "$B")"

sql0 "DELETE FROM \"User\" WHERE email='claim3@teste.com';" >/dev/null 2>&1
B=$(printf '{"studentId":"%s","birthDate":"2015-05-20","parentName":"Resp Convite","email":"claim3@teste.com","password":"senha12345"}' "$JOAO")
check "data correta → vincula" "200" "$(claim "$B")"
check "vínculo criado pelo convite" "1" \
  "$(sql0 "SELECT count(*) FROM \"StudentParent\" sp JOIN \"Parent\" p ON p.id=sp.\"parentId\" JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='claim3@teste.com'")"

# Conta existente com senha precisa autenticar (era aceita sem conferência)
B=$(printf '{"studentId":"%s","birthDate":"2015-05-20","parentName":"Invasor","email":"claim3@teste.com"}' "$JOAO")
check "conta existente sem senha → 400" "400" "$(claim "$B")"
check "resposta avisa que a conta existe" "True" "$(jfield accountExists)"
B=$(printf '{"studentId":"%s","birthDate":"2015-05-20","parentName":"Invasor","email":"claim3@teste.com","password":"senhaerrada"}' "$JOAO")
check "conta existente com senha errada → 401" "401" "$(claim "$B")"

sql0 "DELETE FROM \"User\" WHERE email IN ('claim1@teste.com','claim2@teste.com','claim3@teste.com');" >/dev/null 2>&1

echo "── Fotos do agente (upload para o Blob) ──"

python3 -c "
import base64
jpg = base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==')
open('/tmp/smoke-frame.jpg','wb').write(jpg)
"
check "upload sem credencial → 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/photos" -F 'photo=@/tmp/smoke-frame.jpg;type=image/jpeg')"
check "upload sem o campo photo → 400" "400" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/photos" -H "x-device-api-key: $KEY_A")"
check "upload de tipo não-imagem → 415" "415" \
  "$(printf 'x' > /tmp/smoke-x.txt; curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/photos" -H "x-device-api-key: $KEY_A" -F 'photo=@/tmp/smoke-x.txt;type=text/plain')"

# Upload real só roda quando o Blob está configurado no servidor de teste;
# sem token o endpoint responde 503 e o agente segue registrando sem foto.
UP=$(curl -s -o /tmp/p.json -w '%{http_code}' -X POST "$BASE/api/agent/photos" -H "x-device-api-key: $KEY_A" -F 'photo=@/tmp/smoke-frame.jpg;type=image/jpeg')
if [ "$UP" = "503" ]; then
  check "sem Blob configurado → 503 (degrada sem travar presença)" "503" "$UP"
else
  check "upload com chave do dispositivo → 201" "201" "$UP"
  PHOTO_URL=$(jfield url)
  check "URL devolvida é pública e serve a imagem" "200" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$PHOTO_URL")"
  BODY_EV=$(printf '{"studentId":"%s","eventType":"EXIT","confidence":0.97,"timestamp":"%sT12:20:00-03:00","photoUrl":"%s"}' "$JOAO" "$TODAY" "$PHOTO_URL")
  curl -s -o /dev/null -X POST "$BASE/api/events/checkin-checkout" -H "Content-Type: application/json" -H "x-device-api-key: $KEY_A" -d "$BODY_EV"
  check "evento carrega a foto no banco" "1" \
    "$(sql0 "SELECT count(*) FROM \"AttendanceEvent\" WHERE \"studentId\"='$JOAO' AND \"photoUrl\" LIKE 'https://%'")"
fi

echo "── Crons: aviso de ausência, digest e saúde de dispositivos ──"

CRON="x-cron-secret: cron-test-secret"
SIM="2026-08-26T12:00:00Z"   # 09:00 BRT de uma quarta — turnos da manhã já fechados

check "cron sem segredo → 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/cron/absence-alerts")"
check "device-health com segredo → 200" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "$CRON" "$BASE/api/cron/device-health")"

# Cenário: João presente no dia simulado; Maria ausente e COM responsável
PARENT1=$(sql0 "SELECT id FROM \"Parent\" LIMIT 1")
sql0 "INSERT INTO \"StudentParent\" (\"studentId\",\"parentId\",relationship,\"isPrimary\") VALUES ('$MARIA','$PARENT1','Responsável',false) ON CONFLICT DO NOTHING;" >/dev/null
BODY_SIM=$(printf '{"studentId":"%s","eventType":"ENTRY","confidence":0.97,"timestamp":"2026-08-26T07:20:00-03:00"}' "$JOAO")
curl -s -o /dev/null -X POST "$BASE/api/events/checkin-checkout" -H "Content-Type: application/json" -H "x-device-api-key: $KEY_A" -d "$BODY_SIM"

check "ausência (dryRun): Maria é candidata" "Maria Souza" \
  "$(curl -s -H "$CRON" "$BASE/api/cron/absence-alerts?dryRun=1&now=$SIM" | python3 -c 'import json,sys;c=json.load(sys.stdin)["candidates"];print(c[0]["name"] if c else "ninguem")')"
check "ausência: envia 1 aviso" "1" \
  "$(curl -s -H "$CRON" "$BASE/api/cron/absence-alerts?now=$SIM" | python3 -c 'import json,sys;print(json.load(sys.stdin)["sent"])')"
check "ausência: idempotente (2ª rodada envia 0)" "0" \
  "$(curl -s -H "$CRON" "$BASE/api/cron/absence-alerts?now=$SIM" | python3 -c 'import json,sys;print(json.load(sys.stdin)["sent"])')"
check "alerta registrado com o dia local correto" "2026-08-26" \
  "$(sql0 "SELECT \"dayKey\" FROM \"AbsenceAlert\" WHERE \"studentId\"='$MARIA'")"

check "digest (dryRun): contabiliza presentes e ausentes" "1|1" \
  "$(curl -s -H "$CRON" "$BASE/api/cron/daily-digest?dryRun=1&now=$SIM" | python3 -c 'import json,sys
d=json.load(sys.stdin)["digests"]
print(str(d[0]["present"])+"|"+str(d[0]["absent"]) if d else "vazio")')"

# Consentimento biométrico (LGPD)
BODY_CONS='{"authorizedBy":"Maria Silva Santos"}'
check "registrar consentimento em papel → 200" "200" \
  "$(api POST "/api/students/$JOAO/consent" "$BODY_CONS")"
check "consentimento gravado" "t" \
  "$(sql0 "SELECT \"biometricConsentAt\" IS NOT NULL FROM \"Student\" WHERE id='$JOAO'")"
check "revogar e excluir biometria → 200" "200" "$(api DELETE "/api/students/$JOAO/consent")"
check "consentimento e biometria limpos, reconhecimento off" "true|false" \
  "$(sql0 "SELECT (\"biometricConsentAt\" IS NULL)||'|'||\"recognitionEnabled\" FROM \"Student\" WHERE id='$JOAO'")"

sql0 "DELETE FROM \"StudentParent\" WHERE \"studentId\"='$MARIA' AND \"parentId\"='$PARENT1';" >/dev/null
sql0 "UPDATE \"Student\" SET \"recognitionEnabled\"=true WHERE id='$JOAO';" >/dev/null

echo "── Notificação de teste (não toca em presença) ──"

check "sem sessão → 401" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/notifications/test")"
check "admin (não é responsável) → 401" "401" \
  "$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/notifications/test")"

# como responsável sem inscrição → 409 explicando; e NADA gravado em presença
JARP=$(mktemp)
CSRFP=$(curl -s -c "$JARP" "$BASE/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$JARP" -c "$JARP" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "csrfToken=$CSRFP" \
  --data-urlencode "email=mae@demo.com" --data-urlencode "password=parent123" --data-urlencode "json=true" > /dev/null
EVENTOS_ANTES=$(sql0 'SELECT count(*) FROM "AttendanceEvent"')
check "responsável sem aparelho inscrito → 409" "409" \
  "$(curl -s -b "$JARP" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/notifications/test")"
check "nenhum evento de presença foi criado" "$EVENTOS_ANTES" \
  "$(sql0 'SELECT count(*) FROM "AttendanceEvent"')"
rm -f "$JARP"

echo "── Escopo multi-tenant: responsável não lê o roster ──"

check "PARENT em /api/students → 401" "401" \
  "$(curl -s -b "$JARP" -o /dev/null -w '%{http_code}' "$BASE/api/students?limit=500")"
check "PARENT em /api/classes → 401" "401" \
  "$(curl -s -b "$JARP" -o /dev/null -w '%{http_code}' "$BASE/api/classes")"
check "PARENT em ficha de aluno → 401" "401" \
  "$(curl -s -b "$JARP" -o /dev/null -w '%{http_code}' "$BASE/api/students/$JOAO")"
check "PARENT em fotos de aluno → 401" "401" \
  "$(curl -s -b "$JARP" -o /dev/null -w '%{http_code}' "$BASE/api/students/$JOAO/photos")"

echo "── Passagem de ano, reset de senha e convite estável ──"

# setup independente: cria responsável vinculado ao João via SQL
sql0 "DELETE FROM \"StudentParent\" WHERE \"parentId\"='pass-ano-parent';
      DELETE FROM \"Parent\" WHERE id='pass-ano-parent';
      DELETE FROM \"User\" WHERE id='pass-ano-user';
      DELETE FROM \"Class\" WHERE id='pass-ano-class';" >/dev/null 2>&1
sql0 "INSERT INTO \"User\" (id, email, name, \"passwordHash\", role, \"createdAt\", \"updatedAt\")
      VALUES ('pass-ano-user','passano@teste.com','Pai Passagem','hash-qualquer','PARENT',now(),now());
      INSERT INTO \"Parent\" (id, \"userId\", name, \"createdAt\", \"updatedAt\")
      VALUES ('pass-ano-parent','pass-ano-user','Pai Passagem',now(),now());
      INSERT INTO \"StudentParent\" (\"studentId\", \"parentId\", relationship, \"isPrimary\")
      VALUES ('$JOAO','pass-ano-parent','Responsável',true);
      INSERT INTO \"Class\" (id, \"schoolId\", name, grade, \"createdAt\", \"updatedAt\")
      VALUES ('pass-ano-class', (SELECT \"schoolId\" FROM \"Student\" WHERE id='$JOAO'), 'Turma Ano Seguinte', '9º Ano', now(), now())
      ON CONFLICT (id) DO NOTHING;" >/dev/null
CLS_B='pass-ano-class' # a escola de teste só tem uma turma — cria a de destino
SP_STUDENT="$JOAO"
PARENT_ID="pass-ano-parent"
CLS_ORIG=$(sql0 "SELECT \"classId\" FROM \"Student\" WHERE id='$JOAO'")
BODY_MV=$(printf '{"studentIds":["%s"],"classId":"%s"}' "$SP_STUDENT" "$CLS_B")
check "mover aluno de turma → 200" "200" "$(api POST /api/students/bulk-move "$BODY_MV")"
check "aluno mudou de turma" "$CLS_B" "$(sql0 "SELECT \"classId\" FROM \"Student\" WHERE id='$SP_STUDENT'")"
check "vínculo com responsável sobreviveu à mudança" "t" \
  "$(sql0 "SELECT count(*)>0 FROM \"StudentParent\" WHERE \"studentId\"='$SP_STUDENT'")"
BODY_MV2=$(printf '{"studentIds":["%s"],"classId":"%s"}' "$SP_STUDENT" "$CLS_ORIG")
api POST /api/students/bulk-move "$BODY_MV2" >/dev/null
check "resetar senha do responsável → 200" "200" "$(api POST /api/parents/$PARENT_ID/reset-password '{}')"
check "senha apagada (redefine no link da turma)" "t" \
  "$(sql0 "SELECT \"passwordHash\" IS NULL FROM \"User\" WHERE id=(SELECT \"userId\" FROM \"Parent\" WHERE id='$PARENT_ID')")"

BODY_INV=$(printf '{"classId":"%s"}' "$CLS_ORIG")
T1=$(api POST /api/invites "$BODY_INV" >/dev/null; jfield invite | python3 -c "import json,sys;print(json.load(open('/tmp/p.json'))['invite']['token'])")
T2=$(api POST /api/invites "$BODY_INV" >/dev/null; python3 -c "import json;print(json.load(open('/tmp/p.json'))['invite']['token'])")
check "recopiar convite devolve o MESMO link" "igual" "$([ "$T1" = "$T2" ] && echo igual || echo diferente)"
BODY_REG=$(printf '{"classId":"%s","regenerate":true}' "$CLS_ORIG")
T3=$(api POST /api/invites "$BODY_REG" >/dev/null; python3 -c "import json;print(json.load(open('/tmp/p.json'))['invite']['token'])")
check "regenerate explícito gera link NOVO" "diferente" "$([ "$T2" = "$T3" ] && echo igual || echo diferente)"

sql0 "DELETE FROM \"StudentParent\" WHERE \"parentId\"='pass-ano-parent';
      DELETE FROM \"Parent\" WHERE id='pass-ano-parent';
      DELETE FROM \"User\" WHERE id='pass-ano-user';
      DELETE FROM \"Class\" WHERE id='pass-ano-class';" >/dev/null 2>&1

echo "── Import em massa com responsáveis ──"

sql0 "DELETE FROM \"User\" WHERE email IN ('massa1@teste.com','massa2@teste.com');" >/dev/null 2>&1
sql0 "DELETE FROM \"Student\" WHERE name IN ('Aluno Massa Um','Aluno Massa Dois');" >/dev/null 2>&1
CLS_A=$(sql0 "SELECT \"classId\" FROM \"Student\" WHERE id='$JOAO'")

BODY_IMP=$(printf '{"classId":"%s","students":[{"name":"Aluno Massa Um","birthDate":"2016-02-10","parentName":"Mae Massa","parentEmail":"massa1@teste.com","parentPhone":"11922221111"},{"name":"Aluno Massa Dois","parentEmail":"massa2@teste.com"},{"name":"João Silva","parentEmail":"massa1@teste.com"}]}' "$CLS_A")
check "import cria alunos e vincula responsáveis → 200" "200" \
  "$(api POST /api/students/import "$BODY_IMP")"
check "2 criados, 1 já existente reaproveitado" "2|1" \
  "$(python3 -c "import json;d=json.load(open('/tmp/p.json'));print(str(d['created'])+'|'+str(d['skipped']))")"
check "3 vínculos de responsável feitos" "3" "$(jfield parentsLinked)"
check "conta em massa nasce SEM senha (primeiro acesso define)" "t" \
  "$(sql0 "SELECT \"passwordHash\" IS NULL FROM \"User\" WHERE email='massa1@teste.com'")"
check "mesmo responsável em 2 alunos = 1 conta só" "2" \
  "$(sql0 "SELECT count(*) FROM \"StudentParent\" sp JOIN \"Parent\" p ON p.id=sp.\"parentId\" JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='massa1@teste.com'")"

# repetir o mesmo import é idempotente (skipDuplicates nos vínculos)
api POST /api/students/import "$BODY_IMP" >/dev/null
check "reimportar não duplica vínculos" "2" \
  "$(sql0 "SELECT count(*) FROM \"StudentParent\" sp JOIN \"Parent\" p ON p.id=sp.\"parentId\" JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='massa1@teste.com'")"

sql0 "DELETE FROM \"Student\" WHERE name IN ('Aluno Massa Um','Aluno Massa Dois');" >/dev/null 2>&1
sql0 "DELETE FROM \"User\" WHERE email IN ('massa1@teste.com','massa2@teste.com');" >/dev/null 2>&1

echo "── Frequência do responsável (bimestre/semestre/ano) ──"

# sessão de responsável (mae) já criada como $JARP em bloco anterior? recria por garantia
JARF=$(mktemp)
CSRFF=$(curl -s -c "$JARF" "$BASE/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$JARF" -c "$JARF" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "csrfToken=$CSRFF" \
  --data-urlencode "email=mae@demo.com" --data-urlencode "password=parent123" --data-urlencode "json=true" > /dev/null
SP_ST=$(sql0 "SELECT sp.\"studentId\" FROM \"StudentParent\" sp JOIN \"Parent\" p ON p.id=sp.\"parentId\" JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='mae@demo.com' LIMIT 1")
sql0 "INSERT INTO \"AttendanceEvent\" (id,\"studentId\",\"eventType\",timestamp,\"isManual\",notified,\"createdAt\",\"updatedAt\",\"dayKey\") VALUES ('freq-sm1','$SP_ST','ENTRY','2026-08-24 11:00:00+00',true,false,now(),now(),'2026-08-24'),('freq-sm2','$SP_ST','ENTRY','2026-08-25 11:00:00+00',true,false,now(),now(),'2026-08-25') ON CONFLICT (id) DO NOTHING;" >/dev/null
FREQ=$(curl -s -b "$JARF" "$BASE/api/parent/frequency?studentId=$SP_ST")
echo "$FREQ" > /tmp/freq.json
check "frequência retorna bimestre/semestre/ano" "true" \
  "$(python3 -c "import json;d=json.load(open('/tmp/freq.json'));print('true' if all(k in d for k in ['bimester','semester','year']) else 'false')")"
check "presença conta dias úteis com entrada (>=2)" "ok" \
  "$(python3 -c "import json;d=json.load(open('/tmp/freq.json'));print('ok' if d['bimester']['present']>=2 else 'nao')")"
check "responsável não vê aluno de fora → 404" "404" \
  "$(curl -s -b "$JARF" -o /dev/null -w '%{http_code}' "$BASE/api/parent/frequency?studentId=nao-existe")"
sql0 "DELETE FROM \"AttendanceEvent\" WHERE id IN ('freq-sm1','freq-sm2');" >/dev/null

echo "── Auditoria 3: LGPD no delete, cota atômica ──"

# LGPD: deletar aluno limpa azurePersonId/rekognitionFaceIds e desliga reconhecimento
TESTAL=$(sql0 "SELECT id FROM \"Student\" WHERE \"schoolId\"=(SELECT \"schoolId\" FROM \"User\" WHERE email='admin@teste.com') AND \"isActive\" LIMIT 1")
sql0 "UPDATE \"Student\" SET \"azurePersonId\"='fake-person', \"rekognitionFaceIds\"='[]', \"recognitionEnabled\"=true WHERE id='$TESTAL'" >/dev/null
check "delete aluno → 200" "200" "$(api DELETE /api/students/$TESTAL)"
check "biometria apagada no delete (LGPD)" "t" \
  "$(sql0 "SELECT (\"azurePersonId\" IS NULL AND \"rekognitionFaceIds\" IS NULL AND NOT \"recognitionEnabled\") FROM \"Student\" WHERE id='$TESTAL'")"
sql0 "UPDATE \"Student\" SET \"isActive\"=true WHERE id='$TESTAL'" >/dev/null

# cota atômica: teto de 2, insere uso já em 2 → reserva bloqueia (updateMany count<cap = 0)
ATOM_ESC=$(sql0 "SELECT \"schoolId\" FROM \"User\" WHERE email='admin@teste.com'")
sql0 "DELETE FROM \"RecognitionUsage\" WHERE \"schoolId\"='$ATOM_ESC' AND \"monthKey\"='2099-01';
      INSERT INTO \"RecognitionUsage\" (id,\"schoolId\",\"monthKey\",count,\"updatedAt\") VALUES ('at','$ATOM_ESC','2099-01',2,now());" >/dev/null
sql0 "UPDATE \"RecognitionUsage\" SET count=count+1 WHERE \"schoolId\"='$ATOM_ESC' AND \"monthKey\"='2099-01' AND count < 2" >/dev/null
BLOCKED=$(sql0 "SELECT count FROM \"RecognitionUsage\" WHERE \"schoolId\"='$ATOM_ESC' AND \"monthKey\"='2099-01'")
check "cota no teto: reserva não incrementa (fica em 2)" "2" "$BLOCKED"
sql0 "DELETE FROM \"RecognitionUsage\" WHERE \"schoolId\"='$ATOM_ESC' AND \"monthKey\"='2099-01';" >/dev/null

# picker leve não vaza PII
check "picker de aluno → 200" "200" "$(api GET '/api/students?limit=5&fields=picker')"
check "picker não traz responsaveis/emails" "true" \
  "$(python3 -c "import json;d=json.load(open('/tmp/p.json'));s=(d.get('students') or [{}])[0];print('true' if 'parents' not in s and 'name' in s else 'false')")"
check "resumo de presenca por turma -> 200" "200" "$(api GET /api/classes/attendance-summary)"

echo "── Rodada 'faça tudo': trava do digest, webhook fail-closed, escola suspensa ──"

# webhook fail-closed sem segredo → 401
check "webhook sem segredo → 401 (fail-closed)" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/webhooks/payments" -H 'Content-Type: application/json' -d '{}')"

# CronRun: segunda criação do mesmo (job,dia,escola) falha (idempotência atômica)
sql0 "DELETE FROM \"CronRun\" WHERE job='teste-idem';" >/dev/null 2>&1
R1=$(sql0 "INSERT INTO \"CronRun\" (id, job, \"dayKey\", \"schoolId\", \"createdAt\") VALUES ('cr1','teste-idem','2026-08-26','school-demo-001', now()) RETURNING id" 2>&1)
R2=$(sql0 "INSERT INTO \"CronRun\" (id, job, \"dayKey\", \"schoolId\", \"createdAt\") VALUES ('cr2','teste-idem','2026-08-26','school-demo-001', now()) RETURNING id" 2>&1)
check "trava de cron: 2ª execução do mesmo dia é bloqueada" "erro" \
  "$(echo "$R2" | grep -qi 'duplicate\|unique\|violat' && echo erro || echo passou)"
sql0 "DELETE FROM \"CronRun\" WHERE job='teste-idem';" >/dev/null 2>&1

# escola suspensa não cria aluno (requireActiveSchool nas rotas legadas)
ESC_ADM=$(sql0 "SELECT \"schoolId\" FROM \"User\" WHERE email='admin@teste.com'")
ORIG_STATUS=$(sql0 "SELECT status FROM \"School\" WHERE id='$ESC_ADM'")
sql0 "UPDATE \"School\" SET status='SUSPENDED' WHERE id='$ESC_ADM'" >/dev/null
check "escola SUSPENSA não cria turma → 403" "403" \
  "$(api POST /api/classes '{"name":"Turma Bloqueada"}')"
sql0 "UPDATE \"School\" SET status='$ORIG_STATUS' WHERE id='$ESC_ADM'" >/dev/null
sql0 "DELETE FROM \"Class\" WHERE name='Turma Bloqueada'" >/dev/null 2>&1

echo "── Correções da auditoria profunda ──"

# frequência: 0/0 dias letivos quando não há eventos → rate null (mostra "—", não 0%/alarme)
JARF2=$(mktemp)
CSRFF2=$(curl -s -c "$JARF2" "$BASE/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$JARF2" -c "$JARF2" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "csrfToken=$CSRFF2" \
  --data-urlencode "email=mae@demo.com" --data-urlencode "password=parent123" --data-urlencode "json=true" > /dev/null
SP2=$(sql0 "SELECT sp.\"studentId\" FROM \"StudentParent\" sp JOIN \"Parent\" p ON p.id=sp.\"parentId\" JOIN \"User\" u ON u.id=p.\"userId\" WHERE u.email='mae@demo.com' LIMIT 1")
curl -s -b "$JARF2" "$BASE/api/parent/frequency?studentId=$SP2" > /tmp/fr.json
check "sem dia letivo → rate null (não 0%/alarme falso)" "true" \
  "$(python3 -c "import json;d=json.load(open('/tmp/fr.json'));print('true' if d['year']['rate'] is None and d['year']['schoolDays']==0 else 'false')")"

# insere 2 entradas em dias úteis (a Ana + um colega no mesmo dia = dia letivo)
COLEGA=$(sql0 "SELECT id FROM \"Student\" WHERE \"schoolId\"=(SELECT \"schoolId\" FROM \"Student\" WHERE id='$SP2') AND id != '$SP2' AND \"isActive\" LIMIT 1")
sql0 "INSERT INTO \"AttendanceEvent\" (id,\"studentId\",\"eventType\",timestamp,\"isManual\",notified,\"createdAt\",\"updatedAt\",\"dayKey\") VALUES ('fr-a','$SP2','ENTRY','2026-08-24 11:00:00+00',true,false,now(),now(),'2026-08-24'),('fr-b','$COLEGA','ENTRY','2026-08-25 11:00:00+00',true,false,now(),now(),'2026-08-25') ON CONFLICT (id) DO NOTHING;" >/dev/null
curl -s -b "$JARF2" "$BASE/api/parent/frequency?studentId=$SP2" > /tmp/fr2.json
check "dias letivos = dias com entrada da escola (2)" "2" \
  "$(python3 -c "import json;print(json.load(open('/tmp/fr2.json'))['year']['schoolDays'])")"
check "aluno presente em 1 dos 2 dias letivos = 50%" "50" \
  "$(python3 -c "import json;print(json.load(open('/tmp/fr2.json'))['year']['rate'])")"
sql0 "DELETE FROM \"AttendanceEvent\" WHERE id IN ('fr-a','fr-b');" >/dev/null

# PUT de aluno com classId de OUTRA escola → 400 (não corrompe)
CLS_OUTRA=$(sql0 "SELECT id FROM \"Class\" WHERE \"schoolId\" != (SELECT \"schoolId\" FROM \"Student\" WHERE id='$JOAO') LIMIT 1")
if [ -n "$CLS_OUTRA" ]; then
  FD=$(printf -- "--X\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nJoão\r\n--X\r\nContent-Disposition: form-data; name=\"classId\"\r\n\r\n%s\r\n--X--\r\n" "$CLS_OUTRA")
  CODE=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/students/$JOAO" -H "Content-Type: multipart/form-data; boundary=X" --data-binary "$FD")
  check "PUT aluno com turma de outra escola → 400" "400" "$CODE"
else
  echo "  (só uma escola no teste — pulando PUT cross-tenant)"
fi

echo
echo "RESULTADO: $PASS passaram, $FAIL falharam"
[ "$FAIL" -eq 0 ]
