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

生产站点代码快照在 `apps/xingmai/`（对应 ECS `/opt/mengkai`）。

**后续开发先看这一份：** [docs/给后续开发的人.md](docs/给后续开发的人.md)（谁改什么、怎么交单、什么不能干）。  
`docs/agents/00-cloud-workflow.md` 里的 SSH / 自己 push ECS / 18080 是早期方案，日常不要再跟。
