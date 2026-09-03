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

# 3. 测试连接
./deploy/scripts/connect.sh "echo 连接成功"

# 4. 初始化服务器
./deploy/scripts/setup-server.sh

# 5. 部署
./deploy/scripts/deploy.sh
```

详细说明见 [docs/deployment-aliyun.md](docs/deployment-aliyun.md)。
