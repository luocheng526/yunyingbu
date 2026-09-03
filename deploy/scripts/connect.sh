#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../aliyun/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到配置文件: ${ENV_FILE}"
  echo "请先复制 deploy/aliyun/.env.example 为 deploy/aliyun/.env 并填写服务器信息。"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

: "${ALIYUN_HOST:?请在 .env 中设置 ALIYUN_HOST}"
: "${ALIYUN_USER:=root}"
: "${ALIYUN_PORT:=22}"

KEY_PATH="${HOME}/.ssh/yunyingbu_aliyun"
SSH_OPTS=(-p "${ALIYUN_PORT}" -o StrictHostKeyChecking=accept-new)

if [[ -f "${KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${KEY_PATH}")
fi

echo "正在连接 ${ALIYUN_USER}@${ALIYUN_HOST}:${ALIYUN_PORT} ..."
exec ssh "${SSH_OPTS[@]}" "${ALIYUN_USER}@${ALIYUN_HOST}" "$@"
