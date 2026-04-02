#!/bin/bash
cd "$(dirname "$0")/agent-python"
export PYTHONPATH=/Users/wesleycampos/Library/Python/3.9/lib/python/site-packages
echo "========================================"
echo "  Safe Door — Reconhecimento Facial"
echo "  Conectado em: safedoormvp.vercel.app"
echo "========================================"
echo ""
python3 main.py
