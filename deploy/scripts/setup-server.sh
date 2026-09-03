#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../aliyun/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到配置文件: ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

: "${ALIYUN_HOST:?}"
: "${ALIYUN_USER:=root}"
: "${ALIYUN_PORT:=22}"
: "${ALIYUN_APP_DIR:=/opt/yunyingbu}"

KEY_PATH="${HOME}/.ssh/yunyingbu_aliyun"
SSH_OPTS=(-p "${ALIYUN_PORT}" -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${KEY_PATH}")
fi

REMOTE="${ALIYUN_USER}@${ALIYUN_HOST}"

echo ">>> 初始化服务器目录与基础依赖..."
ssh "${SSH_OPTS[@]}" "${REMOTE}" bash -s <<EOF
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_DIR="${ALIYUN_APP_DIR}"
mkdir -p "\${APP_DIR}" "\${APP_DIR}/releases" "\${APP_DIR}/shared"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! command -v docker compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  echo "安装 Docker Compose 插件..."
  apt-get install -y -qq docker-compose-plugin || true
fi

echo "服务器初始化完成，应用目录: \${APP_DIR}"
EOF

echo ">>> 服务器初始化成功。"
