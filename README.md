# yunyingbu

运营部系统 — 阿里云 ECS 部署支持。

## 快速开始

```bash
# 1. 生成 SSH 密钥
chmod +x deploy/scripts/*.sh
./deploy/scripts/generate-ssh-key.sh

# 2. 配置服务器信息
cp deploy/aliyun/.env.example deploy/aliyun/.env
# 编辑 deploy/aliyun/.env，填入 ECS 公网 IP

# 3. 测试连接（需先把部署公钥写入服务器 authorized_keys）
./deploy/scripts/connect.sh "echo 连接成功"

# 4. 初始化服务器
./deploy/scripts/setup-server.sh

# 5. 部署
./deploy/scripts/deploy.sh
```

目标服务器：阿里云 ECS（华北2 北京）`root@8.140.33.133:22`（`ecs-bj-erp`），SSH 已连通。

占位服务已部署：服务器本机 `http://127.0.0.1:18080/`。详见 [docs/deployment-aliyun.md](docs/deployment-aliyun.md)。

运营部 7 个独立 Agent 提示词（只下发、不直接改站点）：[docs/agents/README.md](docs/agents/README.md)。
