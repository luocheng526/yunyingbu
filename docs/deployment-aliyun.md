# 阿里云 ECS 部署指南

本文档说明如何将 **yunyingbu** 系统连接并部署到阿里云 ECS 服务器。

## 当前实例（华北2 北京）

| 项 | 值 | 如何获取 |
|----|----|----------|
| 公网 IP | `8.140.33.133` | 阿里云控制台 → ECS → 实例 → **公网 IP** |
| SSH 端口 | `22` | 安全组入方向规则；非默认端口看「修改远程连接端口」 |
| 登录用户 | `root` | Ubuntu/Alibaba Cloud Linux 默认多为 `root`；若创建时选了密钥+普通用户，可能是 `ecs-user` |
| 认证方式 | SSH 密钥（已禁用密码登录） | 见下文「如何拿到 SSH 密钥」 |
| 应用目录 | `/opt/yunyingbu` | 无需从控制台获取，部署脚本会自动创建 |

**还缺的唯一关键凭证：能登录该实例的 SSH 私钥，或把本仓库部署公钥写入服务器。**

2026-09-03 探测结果：`8.140.33.133:22` 可连通，但当前部署密钥未被授权（`Permission denied (publickey)`）。

## 如何拿到 SSH 密钥

密码登录已关闭，所以必须用「服务器上已授权的公钥」对应的 **私钥**。按你当初怎么配的实例，选下面一种。

### 方式 A（推荐）：用你现有电脑登录，写入部署公钥

你平时能登录这台 ECS 的那台电脑上执行：

```bash
ssh -i /path/to/your-existing-key root@8.140.33.133
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMWVmFDN20mgwJZoNH4tSADBk1elF5MiWAdK3F3CXKAA yunyingbu-deploy' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

完成后告诉我，我即可用本环境密钥完成初始化与部署。

在本机找现有私钥：

```bash
ls -l ~/.ssh/
# 常见文件名：id_ed25519、id_rsa、xxx.pem（无私钥后缀）
```

Windows 一般在 `C:\Users\<用户名>\.ssh\`。

### 方式 B：阿里云控制台创建的密钥对（.pem）

1. 控制台 → ECS → **网络与安全** → **密钥对**
2. 看绑定到该实例的密钥对名称
3. 私钥只在 **创建密钥对当时** 允许下载一次（`.pem`），控制台无法再次下载
4. 在你当时保存 `.pem` 的电脑上找该文件

若 `.pem` 已丢失：控制台 → 实例 → **更多** → **密码/密钥** → **绑定密钥对 / 重置实例密钥对**（需停机），绑定一把新密钥并立刻保存私钥。

### 方式 C：Workbench / VNC 临时写入公钥

若本机也登不进去：

1. 控制台 → 实例 → **远程连接** → **Workbench** 或 **VNC**
2. 用控制台会话登录后执行方式 A 中的 `echo ... >> authorized_keys`

### 不要做的事

- 不要把 **私钥** 发到聊天、Issue、提交到 Git
- 自动部署请把私钥放到 GitHub Secrets：`ALIYUN_SSH_PRIVATE_KEY`

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

完成「方式 A」把部署公钥写入服务器后，执行：

```bash
./deploy/scripts/connect.sh "echo 连接成功 && uname -a"
./deploy/scripts/setup-server.sh
./deploy/scripts/deploy.sh
```
