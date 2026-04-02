#!/bin/bash
cd "$(dirname "$0")/agent-python"
export PYTHONPATH=/Users/wesleycampos/Library/Python/3.9/lib/python/site-packages
echo "========================================"
echo "  Safe Door — Servidor de Biometria"
echo "  Porta: 8001 (mantiver aberto!)"
echo "========================================"
echo ""
python3 enrollment_server.py
