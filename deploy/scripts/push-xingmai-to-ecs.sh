#!/usr/bin/env bash
# 仅版本发布中心可调用。把发布文档中的文件推到 ECS /opt/mengkai。
# 不改 Nginx、不碰 /opt/yunyingbu。零参数时全量同步（仍不在本脚本内重启）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HOST="${XINGMAI_ECS_HOST:-8.140.33.133}"
USER="${XINGMAI_ECS_USER:-root}"
TARGET="${XINGMAI_DIR:-/opt/mengkai}"
KEY="${XINGMAI_SSH_KEY:-${HOME}/.ssh/id_ed25519}"

SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
SCP=(scp -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY}" ]]; then
  SSH+=(-i "${KEY}")
  SCP+=(-i "${KEY}")
fi
REMOTE="${USER}@${HOST}"

if [[ "$#" -lt 1 ]]; then
  echo "前期无文档，全量同步 apps/xingmai（或仓库根）到 ${TARGET}"
  SOURCE="${REPO_ROOT}"
  if [[ -d "${REPO_ROOT}/apps/xingmai" ]]; then
    SOURCE="${REPO_ROOT}/apps/xingmai"
  fi
  "${SSH[@]}" "${REMOTE}" "mkdir -p '${TARGET}'"
  if command -v rsync >/dev/null 2>&1; then
    rsync -az -e "${SSH[*]}" \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.cursor' \
      "${SOURCE}/public" "${SOURCE}/src" \
      "${SOURCE}/package.json" "${SOURCE}/package-lock.json" \
      "${REMOTE}:${TARGET}/"
  else
    "${SCP[@]}" -r \
      "${SOURCE}/public" "${SOURCE}/src" \
      "${SOURCE}/package.json" "${SOURCE}/package-lock.json" \
      "${REMOTE}:${TARGET}/"
  fi
  "${SSH[@]}" "${REMOTE}" "chown -R mengkai:mengkai '${TARGET}/public' '${TARGET}/src' '${TARGET}/package.json' '${TARGET}/package-lock.json' || true"
  echo "push-xingmai-to-ecs 全量完成（未重启）"
  exit 0
fi

for rel in "$@"; do
  case "${rel}" in
    ""|*".."*|/*|*yunyingbu*)
      echo "拒绝推送路径: ${rel}" >&2
      exit 1
      ;;
  esac
  src="${REPO_ROOT}/${rel}"
  if [[ ! -e "${src}" ]]; then
    echo "本地不存在: ${rel}" >&2
    exit 1
  fi
  dest_dir="$(dirname "${rel}")"
  "${SSH[@]}" "${REMOTE}" "mkdir -p '${TARGET}/${dest_dir}'"
  if [[ -d "${src}" ]]; then
    "${SCP[@]}" -r "${src}" "${REMOTE}:${TARGET}/${dest_dir}/"
  else
    "${SCP[@]}" "${src}" "${REMOTE}:${TARGET}/${rel}"
  fi
  "${SSH[@]}" "${REMOTE}" "chown -R mengkai:mengkai '${TARGET}/${rel}' || true"
  echo "pushed ${rel} -> ${TARGET}/${rel}"
done

echo "push-xingmai-to-ecs 完成（未重启）"
