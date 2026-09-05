#!/usr/bin/env bash
set -euo pipefail
# 将仓库 apps/xingmai 同步到 ECS /opt/mengkai（不重启服务；重启归版本发布中心）
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
SCP_OPTS=(-P "${ALIYUN_PORT}" -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${KEY_PATH}")
  SCP_OPTS+=(-i "${KEY_PATH}")
fi
SRC="${REPO_ROOT}/apps/xingmai"
if [[ ! -f "${SRC}/package.json" ]]; then
  echo "缺少 ${SRC}/package.json"
  exit 1
fi
tar -C "${SRC}" --exclude=node_modules --exclude=.git -czf /tmp/xingmai-push.tar.gz .
scp "${SCP_OPTS[@]}" /tmp/xingmai-push.tar.gz "${ALIYUN_USER}@${ALIYUN_HOST}:/tmp/xingmai-push.tar.gz"
ssh "${SSH_OPTS[@]}" "${ALIYUN_USER}@${ALIYUN_HOST}" bash -s <<'EOF'
set -euo pipefail
mkdir -p /opt/mengkai
tar -xzf /tmp/xingmai-push.tar.gz -C /opt/mengkai
rm -f /tmp/xingmai-push.tar.gz
cd /opt/mengkai
if [[ ! -d node_modules ]]; then
  npm ci --omit=dev
fi
echo "文件已同步到 /opt/mengkai，未重启服务"
EOF
echo "推送完成。重启请走版本发布中心审核后发布。"
