# 阿里云 ECS 部署指南

本文档说明如何将 **yunyingbu** 系统连接并部署到阿里云 ECS 服务器。

## 前置条件

1. 已购买阿里云 ECS 实例（推荐 Ubuntu 22.04 / 24.04）
2. ECS 安全组已放行 **22** 端口（SSH），以及应用端口（如 80、443、8080）
3. 拥有 ECS 公网 IP 和 root（或具有 sudo 权限）账号

## 第一步：生成 SSH 密钥

在本地或 Cloud Agent 环境执行：

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/generate-ssh-key.sh
```

将输出的 **公钥** 添加到阿里云：

- 控制台 → **云服务器 ECS** → **网络与安全** → **密钥对** → 导入/绑定
- 或在实例详情 → **远程连接/安全组** → 将公钥写入 `~/.ssh/authorized_keys`

## 第二步：配置连接信息

```bash
cp deploy/aliyun/.env.example deploy/aliyun/.env
```

编辑 `deploy/aliyun/.env`，填写：

| 变量 | 说明 | 示例 |
|------|------|------|
| `ALIYUN_HOST` | ECS 公网 IP | `47.96.xxx.xxx` |
| `ALIYUN_USER` | SSH 用户名 | `root` |
| `ALIYUN_PORT` | SSH 端口 | `22` |
| `ALIYUN_APP_DIR` | 服务器应用目录 | `/opt/yunyingbu` |

## 第三步：测试 SSH 连接

```bash
./deploy/scripts/connect.sh "echo 连接成功 && uname -a"
```

若输出服务器系统信息，说明连接正常。

## 第四步：初始化服务器

```bash
./deploy/scripts/setup-server.sh
```

该脚本会在服务器上：

- 创建应用目录 `/opt/yunyingbu`
- 安装 Git、curl 等基础工具
- 安装 Docker 与 Docker Compose

## 第五步：手动部署（开发阶段）

```bash
./deploy/scripts/deploy.sh
```

部署流程：打包代码 → 上传到服务器 → 解压到 `releases/` → 更新 `current` 软链接 → 若存在 `deploy/docker-compose.prod.yml` 则自动启动容器。

## 第六步：GitHub Actions 自动部署（可选）

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 |
|-------------|------|
| `ALIYUN_HOST` | ECS 公网 IP |
| `ALIYUN_USER` | SSH 用户名（默认 root） |
| `ALIYUN_PORT` | SSH 端口（默认 22） |
| `ALIYUN_APP_DIR` | 应用目录（默认 `/opt/yunyingbu`） |
| `ALIYUN_SSH_PRIVATE_KEY` | `deploy/scripts/generate-ssh-key.sh` 生成的 **私钥** 完整内容 |

配置完成后，推送到 `main` 分支会自动触发部署；也可在 Actions 页面手动运行 **Deploy to Aliyun ECS**。

## 目录结构

```
deploy/
├── aliyun/
│   ├── .env.example          # 本地连接配置模板
│   └── .env.production.example
├── scripts/
│   ├── generate-ssh-key.sh   # 生成部署用 SSH 密钥
│   ├── connect.sh            # SSH 连接服务器
│   ├── setup-server.sh       # 初始化服务器环境
│   └── deploy.sh             # 部署应用
├── docker-compose.prod.yml   # 生产 Docker Compose
└── Dockerfile                # 应用镜像（待完善）
```

## 常见问题

### 连接超时

- 检查 ECS 安全组是否放行 22 端口
- 确认使用的是 **公网 IP**，而非内网 IP

### Permission denied (publickey)

- 确认公钥已正确添加到服务器 `authorized_keys`
- 确认私钥路径为 `~/.ssh/yunyingbu_aliyun`

### 部署后服务未启动

- 当前为占位 Dockerfile，应用开发完成后需修改 `deploy/Dockerfile` 和 `deploy/docker-compose.prod.yml`
- 在服务器执行：`cd /opt/yunyingbu/current && docker compose -f deploy/docker-compose.prod.yml ps`

## 下一步

请提供以下信息，我可以帮你完成首次连接测试：

1. ECS **公网 IP**
2. SSH **用户名**（通常是 root）
3. 是否已有 SSH 密钥，或需要新生成
