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
sql0 'TRUNCATE "AttendanceEvent", "Invoice", "WebhookEvent", "AuditLog" CASCADE;' >/dev/null
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

echo
echo "RESULTADO: $PASS passaram, $FAIL falharam"
[ "$FAIL" -eq 0 ]
