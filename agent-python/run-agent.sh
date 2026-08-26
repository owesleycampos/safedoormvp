#!/bin/bash
# Watchdog do agente da portaria.
#
# O tablet fica ligado o dia inteiro sem ninguém olhando: se o processo
# morrer (erro de câmera, atualização, queda de energia parcial), este
# script o reergue sozinho em 5 s. Sem isso, um crash às 7h da manhã
# significava portaria cega até alguém reiniciar na mão.
#
# Uso: ./run-agent.sh   (coloque na inicialização do sistema do tablet)
cd "$(dirname "$0")"

echo "🛡️  Porta Segura — watchdog do agente iniciado"
while true; do
  python3 main.py
  code=$?
  echo "⚠️  Agente encerrou (código $code). Reiniciando em 5s... (Ctrl+C para sair)"
  sleep 5 || exit 0
done
