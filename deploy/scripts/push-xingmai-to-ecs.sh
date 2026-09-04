#!/usr/bin/env bash
# 仅版本发布中心可调用。把发布文档中的文件推到 ECS /opt/mengkai。
# 不重启服务、不改 Nginx、不碰 /opt/yunyingbu。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HOST="${XINGMAI_ECS_HOST:-8.140.33.133}"
USER="${XINGMAI_ECS_USER:-root}"
TARGET="${XINGMAI_DIR:-/opt/mengkai}"
KEY="${XINGMAI_SSH_KEY:-${HOME}/.ssh/id_ed25519}"

if [[ "$#" -lt 1 ]]; then
  echo "缺少文件列表，拒绝 push" >&2
  exit 1
fi

SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
SCP=(scp -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [[ -f "${KEY}" ]]; then
  SSH+=(-i "${KEY}")
  SCP+=(-i "${KEY}")
fi
REMOTE="${USER}@${HOST}"

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
