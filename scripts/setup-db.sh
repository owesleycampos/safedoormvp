#!/bin/bash
# ============================================================
# Safe Door Brasil — Configuração do Banco de Dados em Produção
# Rode APÓS criar o banco no Neon (https://neon.tech)
# ============================================================

set -e

echo "🛡️  Safe Door Brasil — Setup do banco de produção"
echo ""

if [ -z "$1" ]; then
  echo "❌ Uso: ./scripts/setup-db.sh 'postgresql://user:password@host/db?sslmode=require'"
  echo ""
  echo "📋 Como obter a URL:"
  echo "   1. Acesse: https://neon.tech"
  echo "   2. Crie conta com GitHub (grátis, 30 segundos)"
  echo "   3. Clique 'Create project' → nome: safedoormvp → região: São Paulo"
  echo "   4. Copie a 'Connection string' (pooled) → cole como argumento deste script"
  echo ""
  exit 1
fi

DATABASE_URL="$1"

echo "✅ URL recebida"
echo ""

# 1. Atualizar variáveis no Vercel
echo "📡 Configurando DATABASE_URL no Vercel..."
echo "$DATABASE_URL" | vercel env rm DATABASE_URL production --yes 2>/dev/null || true
echo "$DATABASE_URL" | vercel env add DATABASE_URL production
echo "$DATABASE_URL" | vercel env rm DIRECT_URL production --yes 2>/dev/null || true
echo "$DATABASE_URL" | vercel env add DIRECT_URL production
echo "✅ Env vars atualizadas no Vercel"
echo ""

# 2. Aplicar schema no banco
echo "🗄️  Aplicando schema Prisma no banco..."
DATABASE_URL="$DATABASE_URL" npx prisma db push
echo "✅ Schema aplicado"
echo ""

# 3. Seed com dados de demo
echo "🌱 Populando dados de demonstração..."
DATABASE_URL="$DATABASE_URL" npx prisma db seed
echo "✅ Dados de demo inseridos"
echo ""

# 4. Fazer novo deploy (pega as novas env vars)
echo "🚀 Fazendo redeploy no Vercel..."
vercel deploy --prod --yes
echo ""
echo "============================================================"
echo "🎉 Safe Door Brasil está 100% operacional!"
echo ""
echo "🌐 URL: https://safedoormvp.vercel.app"
echo ""
echo "👤 Admin:        admin@escolademo.edu.br / admin123"
echo "👨‍👩‍👧 Responsável: mae@demo.com / parent123"
echo ""
echo "🤖 Agente Python (reconhecimento facial):"
echo "   cd agent-python"
echo "   cp .env.example .env  # preencha DEVICE_API_KEY do painel admin"
echo "   pip install face_recognition mediapipe opencv-python fastapi uvicorn"
echo "   python enrollment_server.py  # porta 8001 — treinar biometria"
echo "   python main.py              # iniciar reconhecimento facial"
echo "============================================================"
