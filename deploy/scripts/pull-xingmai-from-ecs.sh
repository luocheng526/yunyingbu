#!/usr/bin/env bash
set -euo pipefail
# 从 ECS 拉取 /opt/mengkai 到仓库 apps/xingmai（不含 node_modules）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/../aliyun/.env"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi
: "${ALIYUN_HOST:=8.140.33.133}"
: "${ALIYUN_USER:=root}"
: "${ALIYUN_PORT:=22}"
KEY_PATH="${HOME}/.ssh/yunyingbu_aliyun"
if [[ -n "${ALIYUN_SSH_PRIVATE_KEY:-}" && ! -f "${KEY_PATH}" ]]; then
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  printf '%s\n' "${ALIYUN_SSH_PRIVATE_KEY}" > "${KEY_PATH}"
  chmod 600 "${KEY_PATH}"
fi
SSH_OPTS=(-p "${ALIYUN_PORT}" -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${KEY_PATH}")
fi
DEST="${REPO_ROOT}/apps/xingmai"
mkdir -p "${DEST}"
ssh "${SSH_OPTS[@]}" "${ALIYUN_USER}@${ALIYUN_HOST}" \
  'tar -C /opt/mengkai --exclude=node_modules --exclude=.git -czf - .' \
  | tar -xzf - -C "${DEST}"
echo "已拉取到 ${DEST}"
