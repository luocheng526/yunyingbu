#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
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
: "${ALIYUN_DEPLOY_BRANCH:=main}"

KEY_PATH="${HOME}/.ssh/yunyingbu_aliyun"
SSH_OPTS=(-p "${ALIYUN_PORT}" -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY_PATH}" ]]; then
  SSH_OPTS+=(-i "${KEY_PATH}")
fi

REMOTE="${ALIYUN_USER}@${ALIYUN_HOST}"
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${ALIYUN_APP_DIR}/releases/${RELEASE_ID}"

echo ">>> 打包并上传代码到 ${REMOTE}:${RELEASE_DIR}"
tar -C "${REPO_ROOT}" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='deploy/aliyun/.env' \
  --exclude='.venv' \
  -czf /tmp/yunyingbu-release.tar.gz .

scp "${SSH_OPTS[@]}" /tmp/yunyingbu-release.tar.gz "${REMOTE}:/tmp/yunyingbu-release.tar.gz"

ssh "${SSH_OPTS[@]}" "${REMOTE}" bash -s <<EOF
set -euo pipefail
APP_DIR="${ALIYUN_APP_DIR}"
RELEASE_DIR="${RELEASE_DIR}"

mkdir -p "\${RELEASE_DIR}"
tar -xzf /tmp/yunyingbu-release.tar.gz -C "\${RELEASE_DIR}"
rm -f /tmp/yunyingbu-release.tar.gz

ln -sfn "\${RELEASE_DIR}" "\${APP_DIR}/current"

if [[ -f "\${APP_DIR}/current/deploy/docker-compose.prod.yml" ]]; then
  cd "\${APP_DIR}/current"
  docker compose -f deploy/docker-compose.prod.yml up -d --build
fi

echo "部署完成: \${RELEASE_DIR}"
EOF

echo ">>> 部署成功。"
