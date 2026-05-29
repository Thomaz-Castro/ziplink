#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cria venv se não existir ou estiver incompleto
if [ ! -f ".venv/bin/activate" ]; then
  rm -rf .venv
  echo "[setup] Instalando python3-venv (requer sudo)..."
  sudo apt-get install -y python3-venv
  echo "[setup] Criando virtualenv..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Instala dependências se necessário
if ! python -c "import locust" 2>/dev/null; then
  echo "[setup] Instalando locust..."
  pip install --quiet locust requests
fi

# Parâmetros com valores padrão (sobrescrevíveis via args)
USERS="${1:-600}"
SPAWN_RATE="${2:-60}"
DURATION="${3:-90s}"
HOST="${4:-http://localhost}"

echo ""
echo "========================================="
echo "  ZipLink Load Test"
echo "  Users: $USERS | Spawn rate: $SPAWN_RATE/s | Duration: $DURATION"
echo "  Host: $HOST"
echo "========================================="
echo ""

locust -f locustfile.py --headless \
  -u "$USERS" \
  -r "$SPAWN_RATE" \
  -t "$DURATION" \
  --host "$HOST" \
  --csv results \
  --csv-full-history \
  --html results.html

echo ""
echo "========================================="
echo "  Resultados salvos em:"
echo "  - results_stats.csv"
echo "  - results_stats_history.csv"
echo "  - results_failures.csv"
echo "  - results.html"
echo "========================================="
