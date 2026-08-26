#!/bin/bash
# Dispara em PRODUÇÃO uma saída (EXIT) da aluna demo Ana Silva Santos com a
# foto de teste anexada — simula exatamente o que a câmera do navegador faz.
# Efeito: push no celular da mãe + foto no feed do admin e na linha do tempo.
# Seguro de repetir: o EXIT só move o horário pra frente, nunca duplica.
set -e

BASE="https://safedoormvp.vercel.app"
DIR="$(mktemp -d)"
JAR="$DIR/cookies.txt"
FOTO="$DIR/frame-teste.jpg"

echo "1/3 Gerando a imagem de teste..."
node -e '
const sharp = require("sharp");
const svg = `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="480" fill="#1e293b"/>
  <circle cx="320" cy="200" r="90" fill="#94a3b8"/>
  <rect x="230" y="290" width="180" height="130" rx="60" fill="#94a3b8"/>
  <text x="320" y="450" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#e2e8f0">TESTE — frame do reconhecimento</text>
</svg>`;
sharp(Buffer.from(svg)).jpeg({quality:80}).toFile(process.argv[1]);
' "$FOTO"

echo "2/3 Entrando como admin demo..."
CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | python3 -c "import json,sys;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=admin@escolademo.edu.br" \
  --data-urlencode "password=admin123" \
  --data-urlencode "json=true"

echo "3/3 Registrando a saída com a foto..."
RESP=$(curl -s -b "$JAR" -X POST "$BASE/api/attendance/recognize" \
  -F "studentId=student-demo-001" \
  -F "type=EXIT" \
  -F "confidence=0.97" \
  -F "photo=@$FOTO;type=image/jpeg")

echo
echo "Resposta do servidor:"
echo "$RESP" | python3 -m json.tool
echo
echo "✅ Feito! Agora olhe:"
echo "   • o push de saída no seu celular"
echo "   • o feed em $BASE/admin/dashboard"
echo "   • a linha do tempo da Ana logando como mae@demo.com / parent123"
rm -rf "$DIR"
