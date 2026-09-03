#!/usr/bin/env bash
set -euo pipefail

KEY_DIR="${HOME}/.ssh"
KEY_NAME="yunyingbu_aliyun"
KEY_PATH="${KEY_DIR}/${KEY_NAME}"

mkdir -p "${KEY_DIR}"
chmod 700 "${KEY_DIR}"

if [[ -f "${KEY_PATH}" ]]; then
  echo "SSH 密钥已存在: ${KEY_PATH}"
  echo "公钥内容（请添加到阿里云 ECS 授权密钥）："
  cat "${KEY_PATH}.pub"
  exit 0
fi

ssh-keygen -t ed25519 -C "yunyingbu-deploy" -f "${KEY_PATH}" -N ""

echo ""
echo "已生成 SSH 密钥对："
echo "  私钥: ${KEY_PATH}"
echo "  公钥: ${KEY_PATH}.pub"
echo ""
echo "请将以下公钥添加到阿里云控制台 -> ECS -> 密钥对 / 实例 -> 授权密钥："
echo "----------------------------------------"
cat "${KEY_PATH}.pub"
echo "----------------------------------------"
