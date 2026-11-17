SET NAMES utf8mb4;
DELETE FROM release_tickets;
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-1',
  '0.1.2-persist',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '落盘验收，勿点通过',
  '["src/modules/releases/persist-json.js"]',
  '重启后此单仍在',
  0,
  'failed',
  1,
  0,
  '2026-09-07 07:30:08',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:34:23',
  '2026-09-07 08:34:23',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-2',
  '0.3.0-home-shell',
  '首页导航与工作台',
  '首页导航与工作台',
  '首页',
  '全站壳改成星脉左导航后台：左侧七项平铺（沈子晗、韩梦凯都是一级菜单），顶栏折叠/页签/退出，首页右侧 KPI+趋势+龙虎榜演示看板。登录页不套这套壳。分支 cursor/home-nav-workbench-e50e 提交 959d003。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/index.html", "src/modules/home/nav-items.js", "test/home.test.js"]',
  '登录后打开 http://zx.xingmaierp.cc/ 应为左白菜单+右数据看板；七项一级平铺无「运营中心」父菜单；点折叠侧栏应变窄；点沈子晗/韩梦凯直接进入；/login 无后台壳；GET /api/home/summary 返回 {"ok":true,"module":"home"}；退出走 POST /api/auth/logout 后回 /login。',
  1,
  'failed',
  2,
  0,
  '2026-09-07 07:32:00',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:35:08',
  '2026-09-07 08:35:08',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-3',
  'shen-0.1.1',
  '沈子晗工作台',
  '沈子晗工作台',
  '沈子晗',
  '沈子晗运营中心第一期：任务列表与今日简报（内存），页面改为左侧竖栏导航、右侧业务区。引用 /shared/layout.css 与 /shared/nav.js，不改首页。',
  '["public/shen.html", "src/modules/shen/store.js", "src/modules/shen/router.js", "src/modules/shen/patch-app.js", "src/app.js", "src/server.js", "scripts/apply-shen-to-mengkai.mjs", "package.json", "package-lock.json", ".gitignore", "test/shen.test.js"]',
  '打开 http://zx.xingmaierp.cc/shen ：标题「沈子晗运营中心」，左侧竖栏 7 项导航，右侧任务列表与今日简报。POST /api/shen/tasks 新增一条任务后刷新页面或再次 GET 仍能看到（进程未重启）。PUT /api/shen/brief 后 GET 读回一致。无需登录。',
  1,
  'failed',
  3,
  0,
  '2026-09-07 07:32:01',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:36:05',
  '2026-09-07 08:36:05',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-4',
  '0.1.2-data',
  '数据中心看板',
  '数据中心看板',
  '数据中心',
  '数据中心看板：演示指标卡（今日订单/待处理/在职人数/本周发布次数）与 GET /api/data/overview。页面挂首页左导航壳（空 #site-nav，业务在 main.xm-page）。PR #5 提交 1044d98。本 Agent 不自行上线。',
  '["public/data.html", "src/modules/data/overview.js", "src/modules/data/router.js", "src/modules/data/patch-app.js", "src/app.js", "src/server.js", "test/data.test.js"]',
  '已登录后打开 http://zx.xingmaierp.cc/data：左侧星脉竖栏，右侧「数据中心」看板。GET http://zx.xingmaierp.cc/api/data/overview 应 200 且 ok/demo 为 true。未登录会跳 /login。建议首页壳 0.3.0-home-shell 先通过。',
  1,
  'failed',
  4,
  0,
  '2026-09-07 07:32:48',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:37:45',
  '2026-09-07 08:37:45',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-5',
  '0.4.0-home-mysql-pool',
  '首页导航与工作台',
  '首页导航与工作台',
  '首页',
  '首页无业务表、导航不连库。新增全站共用 src/db/pool.js（getPool + MYSQL_* 环境变量，utf8mb4，不写死密码）。schema.sql 仅声明不建 profile/people/data/shen/han/releases 表。依赖增加 mysql2。连不上 RDS 不影响首页页面。分支 cursor/home-nav-workbench-e50e 提交 fe8f955。',
  '["src/db/pool.js", "src/modules/home/schema.sql", "package.json", "package-lock.json", "scripts/apply-home-to-mengkai.mjs", ".gitignore", "test/home.test.js"]',
  '首页 / 与 /api/home/summary 行为不变。导航不访问数据库。生产需配置 MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE 并 npm 安装 mysql2，供其他模块 import { getPool } from "../db/pool.js" 或 "../../db/pool.js"。不要创建第二份连接文件。首页不建表。',
  1,
  'failed',
  5,
  0,
  '2026-09-07 07:34:51',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:38:45',
  '2026-09-07 08:38:45',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-6',
  'shen-0.2.0',
  '沈子晗工作台',
  '沈子晗工作台',
  '沈子晗',
  '沈子晗任务与今日简报从进程内存改为 MySQL。新建共用 getPool（src/db/pool.js，对应 apps/xingmai/src/db/pool.js），只建本模块表 shen_tasks、shen_briefs（utf8mb4）。环境变量 MYSQL_HOST/PORT/USER/PASSWORD/DATABASE，未写死密码、未提交 .env。本机连不上 RDS 不算失败：上线后需能连库并 npm 安装 mysql2。',
  '["src/db/pool.js", "src/modules/shen/schema.sql", "src/modules/shen/store.js", "src/modules/shen/router.js", "public/shen.html", "scripts/apply-shen-to-mengkai.mjs", "package.json", "package-lock.json", "test/shen.test.js"]',
  '表结构：shen_tasks(id,title,status,owner,created_at)；shen_briefs(id=1,text,updated_at)，utf8mb4。打开 /shen 新增任务、保存简报后重启进程再 GET /api/shen/tasks 与 /api/shen/brief 仍在。缺少 MYSQL_* 时接口应报缺少环境变量而非写内存。本机 npm test 用假连接池，4 项通过。连不上 RDS 时本单仍应排队，由发布中心上线并配环境变量。',
  1,
  'failed',
  6,
  0,
  '2026-09-07 07:35:52',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:39:40',
  '2026-09-07 08:39:40',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-7',
  'han-0.2.0',
  '韩梦凯中心',
  '韩梦凯中心',
  '韩梦凯',
  '韩梦凯任务与今日简报改为 MySQL（getPool），去掉本模块内存数组。表 han_tasks、han_brief，utf8mb4。连接用 MYSQL_HOST/PORT/USER/PASSWORD/DATABASE，不写死密码。本环境未连 RDS，上线前请在 ECS 配好环境变量并执行 schema.sql（进程启动时也会 CREATE TABLE IF NOT EXISTS）。restart 建议为是。',
  '["src/modules/han/schema.sql", "src/modules/han/store.js", "src/modules/han/router.js", "src/modules/han/index.js", "src/db/pool.js", "apps/xingmai/src/db/pool.js", "src/app.js", "package.json", "package-lock.json", ".gitignore", "test/han.test.js", "test/han-fake-pool.js"]',
  '1) ECS 配置 MYSQL_* 后重启 mengkai。2) 打开 http://zx.xingmaierp.cc/han 添加任务、保存简报。3) GET/POST /api/han/tasks、GET/PUT /api/han/brief。4) 重启后再 GET，任务与简报应仍在（不再丢内存）。5) 韩梦凯任务不得出现在 GET /api/shen/tasks。6) 库中应有 han_tasks、han_brief，无抢建 users/releases。连不上 RDS 时本单仍可排队，由发布中心在有库的环境发版。',
  1,
  'failed',
  7,
  0,
  '2026-09-07 07:36:02',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:45:15',
  '2026-09-07 08:45:15',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-8',
  '0.1.3-oc-shell',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  '把 /releases 做成运营中心这一屏：自用顶栏/英雄区/五个页签/白卡片队列，不改 shared 全站壳，登录页不用这套壳。数量用真实队列接口。',
  '["public/releases.html", "public/releases.css", "src/modules/releases/pipeline/attach.js"]',
  '登录后打开 /releases：顶栏「运营中心」+ 当前页路径、浅色高亮、时间、超管/罗成；英雄区 OPERATING CENTER、「运营中心」、绿色运行胶囊显示 package 版本 0.1.0（不要编造 1.9.x）；五个页签可切换且当前页签蓝下划线；待上线说明交单后出现、状态胶囊为接口真实数量、绿色纪律条、无「提交发布申请」手填表；空队列居中空状态。登录页仍是原登录壳。',
  0,
  'failed',
  8,
  0,
  '2026-09-07 07:50:36',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:47:56',
  '2026-09-07 08:47:56',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-9',
  '0.1.4-charter',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  '编制：罗成主脑调度顺序；本模块是唯一发版闸门不是第二主脑。其它对话帮我上线一律拒绝；/go 仍须本页通过；点一单发一单。',
  '["public/releases.html", "src/modules/releases/charter.js", "src/modules/releases/document.js", "src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/store-mysql.js"]',
  '打开 /releases：待上线说明写明主脑调度、本页是闸门不是第二主脑；绿色条写明其它对话帮我上线无效、点一单发一单。POST /api/releases/go 带「帮我上线」或「帮我上线，发版 首页」均为 409。未点通过的 /go 发版仍 409。未改首页/登录/人员页面。',
  0,
  'failed',
  9,
  0,
  '2026-09-07 08:19:51',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:48:27',
  '2026-09-07 08:48:27',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-10',
  '0.4.1-home-nav-prefetch',
  '首页导航与工作台',
  '首页导航与工作台',
  '首页',
  '侧栏点起来更快：首页 HTML 先画出左菜单和顶栏，不等 nav.js；hover/mousedown 预取 /data /shen /han /people /releases /me；当前页再点自己不整页刷新。未改登录逻辑，不是 SPA。提交 0a1dfc2。',
  '["public/index.html", "public/shared/nav.js", "public/shared/layout.css", "test/home.test.js"]',
  'curl http://zx.xingmaierp.cc/ 应含 xm-shell、侧栏七项、rel=prefetch 指向 /data 等。登录后点侧栏，当前高亮项不应整页闪白；悬停其它项浏览器应发出 prefetch/GET。/login 仍不套壳。',
  1,
  'failed',
  10,
  0,
  '2026-09-07 08:33:28',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:49:25',
  '2026-09-07 08:49:26',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-11',
  '0.1.5-head-only',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  '强制队首才能通过，校验版本号，防止跳单叠发把进程打崩。',
  '["public/releases.html", "src/modules/releases/version.js", "src/modules/releases/charter.js", "src/modules/releases/router.js"]',
  '待上线非第 1 位「通过」禁用。对非队首 POST confirm 返回 409 排队顺序。非法版本号（含 .. 或空格）400。同模块同版本再交 409。锁占用时第二单仍 409 禁止抢发。未改首页/登录/人员。',
  0,
  'failed',
  11,
  0,
  '2026-09-07 08:34:36',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:49:56',
  '2026-09-07 08:49:56',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-12',
  '0.2.2-shared-cache',
  '个人中心（Cursor Cloud https://cursor.com/agents/bc-b02edd1b-12d9-4d4a-ab17-c8878592945a）',
  '个人中心（Cursor Cloud https://cursor.com/agents/bc-b02edd1b-12d9-4d4a-ab17-c8878592945a）',
  '个人中心',
  '侧栏用的 /shared/nav.js 和 layout.css 未登录也能直接 200，并缓存 1 小时。页面 HTML 不缓存，接口 /api 不缓存。登录门还在。',
  '["src/modules/profile/middleware.js", "src/modules/profile/attach.js", "test/profile.test.js"]',
  '未登录 curl /shared/layout.css 和 /shared/nav.js 为 200，Cache-Control 含 max-age=3600。未登录 GET / 和 /me 仍 302 /login。GET /api/auth/me 未登录 401 且 Cache-Control 为 no-store。',
  1,
  'failed',
  12,
  0,
  '2026-09-07 08:35:00',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:50:33',
  '2026-09-07 08:50:33',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-13',
  '0.1.6-manual-refresh',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  '/releases 去掉每 3 秒轮询，改为进页拉一次、之后手动刷新。发版规则未改。',
  '["public/releases.html"]',
  '打开 /releases：进页只请求一次队列相关接口；不再每 3 秒自动 refresh。点「刷新」才再拉。通过/驳回/调序逻辑与队首规则不变。',
  0,
  'failed',
  13,
  0,
  '2026-09-07 08:35:15',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:51:16',
  '2026-09-07 08:51:16',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-14',
  '0.1.7-local-apply',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  'confirm 改为 ECS 本机落地，不再 spawn 缺失的 push-xingmai-to-ecs.sh；失败写 stderr 到单据；通过后全屏升级遮罩，health 200 才关闭。',
  '["public/releases.html", "src/modules/releases/push.js", "src/modules/releases/router.js"]',
  '本机：pushXingmaiToEcs 在临时目录拷文件成功，不执行缺失 sh。线上：新 push.js 落地后点通过不再 ENOENT。遮罩文案「正在升级，请勿关闭」，步骤按单据状态走；重启期间 confirm 中断也保持遮罩；GET /api/health 200 且单据 success 才关遮罩。失败红字展示 log。不自动发下一单。',
  0,
  'failed',
  14,
  0,
  '2026-09-07 08:46:08',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:51:30',
  '2026-09-07 08:51:30',
  '发版失败：spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh ENOENT。已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-15',
  '0.1.8-force-landed',
  '版本发布中心',
  '版本发布中心对话',
  '版本发布中心',
  '强制发布后验活：本机落地 confirm，证明不再 ENOENT。',
  '["src/modules/releases/push.js"]',
  'confirm 成功，log 含本机落地，无 ENOENT。',
  0,
  'success',
  1,
  0,
  '2026-09-07 08:58:52',
  NULL,
  NULL,
  NULL,
  '2026-09-07 08:58:53',
  '2026-09-07 08:58:53',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/push.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
copied src/modules/releases/push.js -> /opt/mengkai/src/modules/releases/push.js
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-16',
  '0.3.0-home-shell-retry',
  '首页',
  '原 rel-2 复检入队',
  '首页',
  '复检：原 0.3.0-home-shell 仅因旧脚本 ENOENT 失败，属假失败。全站左导航壳（七项平铺）。本单只拷闸门允许路径，不含 test。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/index.html", "src/modules/home/nav-items.js"]',
  '打开 / 见到星脉左栏七项；登录页不套这套壳。原单 rel-2。',
  1,
  'success',
  1,
  0,
  '2026-09-07 09:05:20',
  NULL,
  NULL,
  NULL,
  '2026-09-07 09:07:01',
  '2026-09-07 09:56:32',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T09:07:01.672Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-17',
  '0.4.1-home-nav-prefetch-retry',
  '首页',
  '原 rel-10 复检入队',
  '首页',
  '复检：原 0.4.1-home-nav-prefetch 仅 ENOENT 假失败。侧栏先画出、预取各模块。建议排在 home-shell 之后。不含 test。',
  '["public/index.html", "public/shared/nav.js", "public/shared/layout.css"]',
  '首页 HTML 先有左菜单；hover 预取各模块。原单 rel-10。',
  1,
  'success',
  2,
  0,
  '2026-09-07 09:05:21',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:01:47',
  '2026-09-07 10:01:48',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:01:47.698Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-18',
  '0.1.2-data-retry',
  '数据中心',
  '原 rel-4 复检入队',
  '数据中心',
  '复检：原 0.1.2-data 仅 ENOENT 假失败。数据中心看板与 /api/data/overview。不含 test。',
  '["public/data.html", "src/modules/data/overview.js", "src/modules/data/router.js", "src/modules/data/patch-app.js"]',
  '打开 /data 见到 KPI 卡；GET /api/data/overview 200。原单 rel-4。未改 src/app.js（线上已挂数据路由）。',
  1,
  'success',
  3,
  0,
  '2026-09-07 09:05:21',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:03:46',
  '2026-09-07 10:03:46',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:03:46.374Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-19',
  'shen-0.1.1-retry',
  '沈子晗',
  '原 rel-3 复检入队',
  '沈子晗',
  '复检：原 shen-0.1.1 仅 ENOENT 假失败。第一期内存任务/简报+左栏。去掉 scripts/test/.gitignore（闸门不拷）。',
  '["public/shen.html", "src/modules/shen/store.js", "src/modules/shen/router.js", "src/modules/shen/patch-app.js"]',
  '打开 /shen 左栏+任务/简报。原单 rel-3。未带 package.json/app.js，避免覆盖全站。',
  1,
  'success',
  4,
  0,
  '2026-09-07 09:05:21',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:04:27',
  '2026-09-07 10:04:27',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:04:27.156Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-20',
  'ui-cursor-light-f287183',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '全站统一 Cursor 浅色壳层：共享侧栏/顶栏、登录页纸色卡片，去掉 :18080 提示。git commit f287183，分支 cursor/aliyun-deploy-setup-63da。',
  '["apps/xingmai/public/shared/layout.css", "apps/xingmai/public/shared/nav.js", "apps/xingmai/public/login.css", "apps/xingmai/public/login.html", "apps/xingmai/public/index.html", "apps/xingmai/public/me.html", "apps/xingmai/public/releases.html", "apps/xingmai/src/modules/home/pages.js", "apps/xingmai/src/modules/home/nav-items.js", "apps/xingmai/src/modules/profile/middleware.js", "apps/xingmai/src/modules/profile/gate.js"]',
  '打开 https://zx.xingmaierp.cc/login 为浅色卡片且无 :18080；登录后各页同一左侧星脉侧栏，按钮为墨色不是青绿。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 10:07:59',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:15:35',
  '2026-09-07 10:15:35',
  '发版失败：拒绝推送路径: apps/xingmai/public/shared/layout.css stderr: 拒绝推送路径: apps/xingmai/public/shared/layout.css 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-21',
  '0.1.9-version-rollback',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '版本号占用校验、升级前快照、回滚；删文件投喂/Worker/制品/主题切换。',
  '["public/releases.html", "public/releases.css", "src/modules/releases/charter.js", "src/modules/releases/push.js", "src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/version.js", "test/releases.test.js"]',
  '打开 /releases 只有待上线、版本记录、运行日志；版本记录显示当前版本；有快照的成功单可回滚。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 10:18:43',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:20:58',
  '2026-09-07 10:20:58',
  '发版失败：拒绝推送路径: test/releases.test.js stderr: 拒绝推送路径: test/releases.test.js 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-22',
  '0.1.10-allow-test',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '落地白名单加上 test/；交单时校验路径。本单文件不含 test，避免再被旧白名单拒。',
  '["src/modules/releases/push.js", "src/modules/releases/router.js", "src/modules/releases/charter.js", "public/releases.html"]',
  '通过不再因 test 路径失败；交单写 deploy/ 应 400。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:23:15',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:23:38',
  '2026-09-07 10:23:39',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:23:38.729Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-23',
  'probe-test-path-do-not-pass',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '探测交单是否接受 test 路径，随后驳回',
  '["test/releases.test.js"]',
  '探测后驳回，禁止通过',
  0,
  'rejected',
  1,
  0,
  '2026-09-07 10:25:44',
  '运营部主脑',
  '2026-09-07 10:26:20',
  '探测单，禁止通过。仅用于确认交单是否接受 test 路径。',
  NULL,
  NULL,
  '已驳回：探测单，禁止通过。仅用于确认交单是否接受 test 路径。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-24',
  '0.1.9-version-rollback',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '复检 rel-21：原单因 test/releases.test.js 被旧白名单拒。本单去掉 test，文件已写入源目录。版本占用、升级前快照回滚、三个页签。',
  '["public/releases.html", "public/releases.css", "src/modules/releases/charter.js", "src/modules/releases/push.js", "src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/version.js"]',
  '打开 /releases 只有待上线、版本记录、运行日志；GET /api/releases/versions 200；有快照可回滚。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:27:29',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:28:03',
  '2026-09-07 10:28:03',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:28:03.109Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-25',
  'ui-cursor-light-20260907-1032',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '再推一次：全站统一 Cursor 浅色壳层。共享侧栏/顶栏、登录页纸色卡片，去掉 :18080。git commit f287183，分支 cursor/aliyun-deploy-setup-63da。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/login.css", "public/login.html", "public/index.html", "public/me.html", "public/releases.html", "src/modules/home/pages.js", "src/modules/home/nav-items.js", "src/modules/profile/middleware.js", "src/modules/profile/gate.js", "test/ui-shell.test.js"]',
  '打开 https://zx.xingmaierp.cc/login 为浅色卡片且无 :18080；登录后各页同一左侧星脉侧栏，按钮为墨色不是青绿。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 10:32:06',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:32:37',
  '2026-09-07 10:32:38',
  '发版失败：源目录不存在: test/ui-shell.test.js（/var/lib/mengkai/source/test/ui-shell.test.js） code=ENOENT stderr: 源目录不存在: test/ui-shell.test.js（/var/lib/mengkai/source/test/ui-shell.test.js） 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-26',
  '0.2.3-session-persist',
  '个人中心',
  '版本发布中心',
  '个人中心',
  '登录会话写入 /var/lib/mengkai/sessions.json，发版重启后仍认 mk_sid，不必重新登录。Cookie 7 天。',
  '["src/modules/profile/auth.js"]',
  '登录后点通过并重启，刷新 /releases 仍是已登录，不跳 /login。',
  1,
  'success',
  2,
  0,
  '2026-09-07 10:35:19',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:37:59',
  '2026-09-07 10:37:59',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:37:59.035Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-27',
  'ui-cursor-light-2',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '重写浅色升级 cursor-light-2。只改已存在的壳层文件：登录页纸色卡片、共享侧栏/顶栏、登录后各业务页同一导航。不改 /releases 运营中心页，不带 test 新文件。git 82c986a。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/login.css", "public/login.html", "public/index.html", "public/me.html", "src/modules/profile/middleware.js"]',
  '未登录打开 /shared/layout.css 和 /shared/nav.js 为 200。/login 纸色卡片、无 :18080、无红色登录皮。登录后首页/数据/个人中心同一左侧星脉侧栏。/releases 仍是运营中心自己的顶栏，不被侧栏包住。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:35:56',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:37:22',
  '2026-09-07 10:37:23',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:37:22.063Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-28',
  '0.1.11-gate-label',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '页头改为版本发布中心；新单据 15 秒内自动提示并刷新，不会自动通过。',
  '["public/releases.html"]',
  '打开 /releases 标题是版本发布中心不是运营中心；其它板块交单后顶部提示有新的待上线。',
  0,
  'success',
  1,
  0,
  '2026-09-07 10:38:28',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:39:30',
  '2026-09-07 10:39:30',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-28
copied public/releases.html -> /opt/mengkai/public/releases.html
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-29',
  '0.1.12-stable-queue',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '交单按稳定顺序排队：登录/依赖 → 共享壳 → 业务 → 发布中心页，不再只按谁先交。主脑仍可上移下移，只允许通过第 1 位。',
  '["src/modules/releases/order.js", "src/modules/releases/store-memory.js", "src/modules/releases/store-mysql.js", "src/modules/releases/charter.js", "public/releases.html"]',
  '后交的登录/共享壳会排到业务和发布页前面。不会自动通过。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:42:53',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:43:23',
  '2026-09-07 10:43:25',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:43:23.668Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-30',
  '0.3.1-cursor-light-land',
  '首页',
  '主框架',
  '首页',
  '复检 rel-27：当时源目录仍是旧星脉壳，锁回收标成功但界面几乎没变。本单写入 82c986a 浅色壳到源目录：登录纸色卡片、共享侧栏/顶栏、首页/个人中心。不改 /releases。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/login.css", "public/login.html", "public/index.html", "public/me.html", "src/modules/profile/middleware.js"]',
  '强制刷新 / 和 /login，侧栏浅底、登录纸色卡片；/releases 仍是版本发布中心自己的壳。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:45:19',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:45:49',
  '2026-09-07 10:45:49',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:45:49.360Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-31',
  '0.1.13-reload-after',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '升级健康检查 200 后自动整页刷新 /releases，避免还看着旧界面。不自动通过下一单。',
  '["public/releases.html"]',
  '点通过，遮罩完成后浏览器自己打开新的 /releases。',
  0,
  'success',
  1,
  0,
  '2026-09-07 10:46:42',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:47:11',
  '2026-09-07 10:47:11',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-31
copied public/releases.html -> /opt/mengkai/public/releases.html
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-32',
  '0.1.14-history-newest',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '版本记录和运行日志按发布时间从最新到最老。',
  '["public/releases.html"]',
  '打开版本记录，最新成功单在第一行。',
  0,
  'success',
  1,
  0,
  '2026-09-07 10:48:52',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:49:11',
  '2026-09-07 10:49:11',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-32
copied public/releases.html -> /opt/mengkai/public/releases.html
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-33',
  'ui-cursor-light-3',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '侧栏始终展开；点开各中心后去掉模块自带侧栏，内容区统一 Cursor 浅色。/releases 也注入全站壳。git 9ab97ff。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/index.html", "public/me.html", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '登录后任一业务页左侧星脉侧栏一直在，没有折叠按钮。沈/韩/人员页不再出现第二套侧栏。内容卡片/按钮/输入框同色。版本发布中心也有同一侧栏。登录页仍无侧栏。',
  1,
  'success',
  1,
  0,
  '2026-09-07 10:51:01',
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:59:47',
  '2026-09-07 10:59:47',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T10:59:47.212Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-34',
  '0.1.15-mask-until-reload',
  '版本发布中心 Agent',
  '版本发布中心对话',
  '版本发布中心',
  '通过后遮罩保持到健康检查和整页刷新完成；新页面读完数据再关遮罩；失败才提前关；不会自动通过下一单。',
  '["public/releases.html", "test/releases.test.js"]',
  '点通过后遮罩不提前关；健康检查 200 后出现「正在刷新界面」并整页刷新；刷新后读完队列和版本才关遮罩并提示成功。不会自动通过下一单。',
  0,
  'success',
  2,
  0,
  '2026-09-07 11:04:28',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:16:32',
  '2026-09-07 11:16:32',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-34
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-35',
  'ui-china-time-1',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '全站时间改北京时间 Asia/Shanghai。顶栏时钟、发布页时钟、单据上的 UTC 时间都转成北京时间。git d42cdf0。',
  '["public/shared/nav.js", "public/shared/layout.css", "src/server.js"]',
  '登录后顶栏时间是北京时间（UTC+8），不是 UTC。发版单提交时间不再带 UTC 后缀，比 ISO 多 8 小时。例如 10:35Z 显示 18:35。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:10:42',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:15:09',
  '2026-09-07 11:15:10',
  '锁已回收：发布中进程被重启打断（开始于 2026-09-07T11:15:09.360Z）。代码多半已落地，下一条不会自动发。请刷新后继续审批下一单。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-36',
  '0.1.16-persist-before-restart',
  '版本发布中心 Agent',
  '版本发布中心对话',
  '版本发布中心',
  '通过后先把成功状态和快照路径写入 tickets.json，再重启。重启打断且没有快照目录时记失败，不再假成功。',
  '["src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/charter.js", "test/releases.test.js", "test/releases-mysql.test.js"]',
  '需要重启的单据：成功日志先出现「成功状态已先落盘」再重启。进程被杀时若无快照目录，单据为失败而不是锁已回收成功。不会自动通过下一单。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:18:28',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:22:26',
  '2026-09-07 11:22:32',
  '重启打断后发现升级前快照目录，按已拷贝处理。请打开页面确认文件，不要自动发下一单。（开始于 2026-09-07T11:22:26.703Z）'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-37',
  '0.1.17-apply-receipt',
  '版本发布中心 Agent',
  '版本发布中心对话',
  '版本发布中心',
  '交单前检查源文件存在；源与线上相同则拒绝空转；拷贝后写 apply-receipt；锁回收只认回执；不再误用 apps/xingmai 当源目录。',
  '["src/modules/releases/push.js", "src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/charter.js", "test/releases.test.js", "test/releases-mysql.test.js"]',
  '缺文件的单据交不进去。源与线上相同的单通过会失败而不是假成功。需要重启的单先落盘再重启。不会自动通过下一单。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:24:00',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:28:54',
  '2026-09-07 11:28:55',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/push.js、src/modules/releases/router.js、src/modules/releases/store-memory.js、src/modules/releases/charter.js、test/releases.test.js、test/releases-mysql.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 6 个路径 -> /var/lib/mengkai/snapshots/rel-37
copied src/modules/releases/push.js -> /opt/mengkai/src/modules/releases/push.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied src/modules/releases/store-memory.js -> /opt/mengkai/src/modules/releases/store-memory.js
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
copied test/releases-mysql.test.js -> /opt/mengkai/test/releases-mysql.test.js
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-38',
  '0.3.2-sider-always',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '复检侧栏常显未落地：上一单 rel-33 重启打断，线上仍是旧 nav.js（跳过 /releases，不拆沈/韩/人员自带侧栏）。本单接首页 0.3.1 领号 0.3.2。全局 HTML 注入 /shared/nav.js，侧栏始终展开，拆掉模块第二侧栏。git 2fc3004。按提交时间入队，不上移。',
  '["public/shared/nav.js", "public/shared/layout.css", "src/modules/profile/middleware.js", "src/modules/profile/attach.js", "src/modules/home/pages.js"]',
  '登录后打开 / /data /shen /han /people /releases /me，每页都有左侧星脉侧栏且不能折叠。沈/韩/人员没有第二套侧栏。/releases 也有同一侧栏。登录页没有侧栏。未登录打开 /shared/nav.js 能看到注释 xm-shell-always 0.3.2。',
  1,
  'rejected',
  1,
  0,
  '2026-09-07 11:37:07',
  '运营部主脑',
  '2026-09-07 11:39:16',
  '版本号 0.3.2 未按版本发布中心 0.1.x 队列领取，作废重排。',
  NULL,
  NULL,
  '已驳回：版本号 0.3.2 未按版本发布中心 0.1.x 队列领取，作废重排。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-39',
  '0.1.18-sider-always',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '侧栏常显未落地复检。接版本发布中心当前号 0.1.17，领取 0.1.18。全局 HTML 注入共享壳，各板块侧栏一直展开，拆模块自带侧栏。git 2fc3004。按提交时间入队，不上移。',
  '["public/shared/nav.js", "public/shared/layout.css", "src/modules/profile/middleware.js", "src/modules/profile/attach.js", "src/modules/home/pages.js"]',
  '登录后 / /data /shen /han /people /releases /me 都有左侧星脉侧栏且不折叠。沈/韩/人员无第二侧栏。/shared/nav.js 含 xm-shell-always 0.3.2。登录页无侧栏。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 11:39:17',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:41:33',
  '2026-09-07 11:41:34',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-40',
  '0.1.19-skip-restart',
  '罗成',
  '罗成',
  '版本发布中心',
  '只改页面或测试时不重启进程，避免打断正在使用的人；改 src 或依赖才排空请求后重启。',
  '["public/releases.html", "src/server.js", "src/modules/releases/restart.js", "src/modules/releases/router.js", "src/modules/releases/charter.js", "test/releases.test.js"]',
  '本地 npm test 三轮 86/86；跳过重启用例连跑 20 次无失败。通过后 /releases 写明不重启进程，page-only 单不再 systemctl restart。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:44:14',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:44:28',
  '2026-09-07 11:44:28',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、src/server.js、src/modules/releases/restart.js、src/modules/releases/router.js、src/modules/releases/charter.js、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 6 个路径 -> /var/lib/mengkai/snapshots/rel-40
copied public/releases.html -> /opt/mengkai/public/releases.html
copied src/server.js -> /opt/mengkai/src/server.js
copied src/modules/releases/restart.js -> /opt/mengkai/src/modules/releases/restart.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-40/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-41',
  '0.1.19-shell-perf',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '空页卡顿：侧栏每次整页跳转还会预取另外 6 个模块；css/js Cache-Control max-age=0，点一下打 7+ 次请求。去掉预取，共享壳缓存 1 小时，时钟不再每秒扫 DOM。接 0.1.18。git 9a6eb75。源目录必须写入这份新 nav.js，上一单 0.1.18 因源目录与线上相同被拒。按提交时间入队。',
  '["public/shared/nav.js", "src/app.js", "src/modules/profile/middleware.js"]',
  '未登录打开 /shared/nav.js 含 xm-shell-always 0.1.19，且不含 prefetch。响应头 Cache-Control 含 max-age=3600。点侧栏不再同时打出 6 个预取。登录页无侧栏。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 11:44:57',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:45:29',
  '2026-09-07 11:45:29',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-42',
  '0.1.20-version-ledger',
  '罗成',
  '罗成',
  '版本发布中心',
  '版本号改由本闸门统一发放。全站一条号 0.1.N-说明，各模块不得自领；同一号段不能跨模块再用。失败的 0.1.18 / 0.1.19 首页单已按新号拉回。',
  '["public/releases.html", "src/modules/releases/version.js", "src/modules/releases/router.js", "src/modules/releases/charter.js", "test/releases.test.js"]',
  'GET /api/releases/next 返回下一号。交单填 auto 或不填版本号即发放。自领 ui-cursor-light-3 或跨模块抢同一 0.1.N 返回 409。页面写明统一发放。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:54:57',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:56:16',
  '2026-09-07 11:56:16',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、src/modules/releases/version.js、src/modules/releases/router.js、src/modules/releases/charter.js、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-42
copied public/releases.html -> /opt/mengkai/public/releases.html
copied src/modules/releases/version.js -> /opt/mengkai/src/modules/releases/version.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-42/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-43',
  '0.1.21-sider-always',
  '罗成运营部主脑',
  '首页 / 拉回 rel-39',
  '首页',
  '拉回失败单 rel-39 0.1.18-sider-always。源目录已写入 git 2fc3004 的壳注入（pages/attach）以及后续 9a6eb75 的常显侧栏 nav（无预取）。layout.css 与线上相同。按提交时间入队，不上移。',
  '["public/shared/nav.js", "public/shared/layout.css", "src/modules/profile/middleware.js", "src/modules/profile/attach.js", "src/modules/home/pages.js"]',
  '登录后 / /data /shen /han /people /releases /me 都有左侧星脉侧栏。/shared/nav.js 含 xm-shell-always。登录页无侧栏。',
  1,
  'success',
  2,
  0,
  '2026-09-07 11:54:57',
  NULL,
  NULL,
  NULL,
  '2026-09-07 11:56:26',
  '2026-09-07 11:56:27',
  '按发布文档发版（模块 首页）。已推送：public/shared/nav.js、public/shared/layout.css、src/modules/profile/middleware.js、src/modules/profile/attach.js、src/modules/home/pages.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-43
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/shared/layout.css -> /opt/mengkai/public/shared/layout.css
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
copied src/modules/profile/attach.js -> /opt/mengkai/src/modules/profile/attach.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
落地回执 /var/lib/mengkai/snapshots/rel-43/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-44',
  '0.1.22-shell-perf',
  '罗成运营部主脑',
  '首页 / 拉回 rel-41',
  '首页',
  '拉回失败单 rel-41 0.1.19-shell-perf。原号段 0.1.19 已被版本发布中心 0.1.19-skip-restart 占用，现改领 0.1.22。app.js 只合并 css/js 缓存 1 小时，保留 data/shen/han/people 路由，不覆盖会拆模块的旧稿。git 9a6eb75。',
  '["public/shared/nav.js", "src/app.js", "src/modules/profile/middleware.js"]',
  '未登录打开 /shared/nav.js 含 xm-shell-always 且不含 prefetch。css/js 响应头 Cache-Control 含 max-age=3600。/api/data /api/shen /api/han /api/people /api/releases 仍在。登录页无侧栏。',
  1,
  'success',
  1,
  0,
  '2026-09-07 11:54:58',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:04:43',
  '2026-09-07 12:04:43',
  '按发布文档发版（模块 首页）。已推送：public/shared/nav.js、src/app.js、src/modules/profile/middleware.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 3 个路径 -> /var/lib/mengkai/snapshots/rel-44
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied src/app.js -> /opt/mengkai/src/app.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
落地回执 /var/lib/mengkai/snapshots/rel-44/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-45',
  '0.1.23-releases-ui-guard',
  '罗成',
  '罗成',
  '版本发布中心',
  '首页壳会拆掉 .oc-top，#clock/#who 变成 null 后队列渲染中断。本页写 textContent 先判空，并把时钟和用户名放到英雄区。',
  '["public/releases.html", "test/releases.test.js"]',
  '打开 /releases 不再报 Cannot set properties of null。待上线能看到 rel-44 0.1.22-shell-perf。刷新不崩。',
  1,
  'success',
  2,
  0,
  '2026-09-07 12:03:18',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:04:59',
  '2026-09-07 12:04:59',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-45
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-45/apply-receipt.json
本机落地完成（未重启） 只改了页面或测试文件，已跳过重启，避免打断正在使用的人。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-46',
  '0.1.24-releases-scroll',
  '罗成',
  '罗成',
  '版本发布中心',
  '共享壳把 body 锁成 overflow:hidden，版本记录和运行日志超长后裁切不能下滚。本页样式解开滚动。',
  '["public/releases.css", "test/releases.test.js"]',
  '打开 /releases 点版本记录、运行日志，可以滚到表格和日志底部。待上线仍能滚。',
  0,
  'success',
  1,
  0,
  '2026-09-07 12:07:56',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:12:33',
  '2026-09-07 12:12:33',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.css、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-46
copied public/releases.css -> /opt/mengkai/public/releases.css
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-46/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-47',
  '0.1.25-sider-spa',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '侧栏点击改为页内切换：只拉下一页 HTML 换内容区，不再整页重载 layout.css/nav.js/auth/me。悬停预取。用来消掉十点几秒的串行瀑布流。',
  '["public/shared/nav.js", "public/shared/layout.css"]',
  '登录后点侧栏：顶栏立刻变页签名，不是整页白屏刷新；DevTools 里同一次点击不应再下载 layout.css 和 nav.js。源码含 xm-shell-spa 0.1.24。',
  0,
  'failed',
  2,
  0,
  '2026-09-07 12:08:22',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:12:59',
  '2026-09-07 12:12:59',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-48',
  '0.1.25-releases-scroll-page',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '修复共享壳锁死后版本记录/运行日志不能下滚；待上线、版本记录、运行日志都做成每页 20 条翻页。',
  '["public/releases.html", "public/releases.css", "test/releases.test.js"]',
  '打开 /releases，硬刷新后切到版本记录和运行日志能在主内容区下滚；超过 20 条出现首页/上一页/下一页/末页；翻到第 2 页后不能把该页第一条当队首点通过。',
  0,
  'failed',
  1,
  0,
  '2026-09-07 12:16:36',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:17:54',
  '2026-09-07 12:17:54',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-49',
  '0.1.26-sider-spa',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '升级：侧栏页内切换，去掉整页重载导致的10秒卡顿。git cursor/sider-spa-nav-63da 75b4f53。',
  '["public/shared/nav.js", "public/shared/layout.css"]',
  '登录后点侧栏顶栏立刻变页签，不是整页白屏。nav.js 含 xm-shell-spa 0.1.25。同一次点击不再下载 layout.css/nav.js。',
  0,
  'failed',
  2,
  0,
  '2026-09-07 12:17:10',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:18:25',
  '2026-09-07 12:18:26',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-50',
  '0.1.25-spa-time',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '重做升级：侧栏页内切换；发布页时钟和单据时间改为北京时间，不再显示 UTC。git cursor/sider-spa-nav-63da 69309da',
  '["public/shared/nav.js", "public/shared/layout.css", "public/releases.html"]',
  '点侧栏不整页白屏。顶栏和发布页时钟是北京时间。单据时间不再带 UTC。nav.js 含 xm-shell-spa 0.1.25，releases.html 含 xm-china-time 0.1.25。',
  0,
  'failed',
  1,
  0,
  '2026-09-07 12:24:24',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:25:23',
  '2026-09-07 12:25:23',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-51',
  '0.1.25-source-first',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '按正确顺序验收：只改源目录，交单后再通过。页面写明不要先拷到线上。',
  '["public/releases.html", "test/releases.test.js"]',
  '通过后 /releases 纪律区出现「不要先拷到线上」「点通过才落地」。通过前线上没有这两句。',
  0,
  'success',
  1,
  0,
  '2026-09-07 12:45:59',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:46:00',
  '2026-09-07 12:46:00',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-51
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-51/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-52',
  '0.1.26-source-first',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '重做源目录先放再通过：缩短纪律文案，不先拷线上。',
  '["public/releases.html", "test/releases.test.js"]',
  '通过前线上仍是旧句；通过后纪律区出现「新文件只放源目录」。',
  0,
  'success',
  1,
  0,
  '2026-09-07 12:49:29',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:49:29',
  '2026-09-07 12:49:29',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-52
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-52/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-53',
  '0.1.27-spa-skin',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '重做：侧栏页内切换；北京时间；版本发布中心右侧内容改成和主壳同一套纸色/墨色，去掉蓝灰 Ant 风。git cursor/oc-shell-skin-63da 558ef36',
  '["public/shared/nav.js", "public/shared/layout.css", "public/releases.html", "public/releases.css"]',
  '点侧栏不整页白屏。顶栏和发布页是北京时间。打开 /releases，右边背景、页签、按钮、锁和主壳一样是纸色#f7f7f4/墨色#14120b，不再是蓝底蓝按钮。releases.css 含 xm-shell-skin 0.1.27。',
  0,
  'success',
  1,
  0,
  '2026-09-07 12:54:57',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:56:32',
  '2026-09-07 12:56:32',
  '按发布文档发版（模块 首页）。已推送：public/shared/nav.js、public/shared/layout.css、public/releases.html、public/releases.css。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 4 个路径 -> /var/lib/mengkai/snapshots/rel-53
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/shared/layout.css -> /opt/mengkai/public/shared/layout.css
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/releases.css -> /opt/mengkai/public/releases.css
落地回执 /var/lib/mengkai/snapshots/rel-53/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-54',
  '0.1.28-history-brief',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '版本记录只显示每次升级的简要摘要，详细落地流水留在运行日志。',
  '["public/releases.html", "test/releases.test.js"]',
  '打开 /releases 版本记录：列是版本/模块/摘要/时间/回滚，没有整段落地日志。运行日志仍有完整 log。',
  0,
  'success',
  2,
  0,
  '2026-09-07 12:55:33',
  NULL,
  NULL,
  NULL,
  '2026-09-07 12:57:05',
  '2026-09-07 12:57:05',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-54
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-54/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-55',
  '0.1.29-han-keepalive',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '点韩梦凯约5秒：Node keepAliveTimeout 默认5秒，nginx还复用已断连接。改为65秒。侧栏页内切换。壳资源 preload。git cursor/oc-shell-skin-63da 604188a',
  '["src/server.js", "src/modules/profile/middleware.js", "public/shared/nav.js", "public/shared/layout.css"]',
  '打开任意页停6秒以上再点韩梦凯，不应再卡满5秒。nav.js 含 xm-shell-spa 0.1.25。server.js 含 keepAliveTimeout = 65_000。需重启。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 13:02:06',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:02:40',
  '2026-09-07 13:02:40',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 stderr: 源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-56',
  '0.1.29-shell-align',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '发布中心页面色板、页签和卡片对齐线上主壳纸色墨色，避免页签被主壳按钮样式刷成黑块。',
  '["public/releases.html", "public/releases.css", "test/releases.test.js"]',
  '打开 /releases：纸色底、墨色按钮；三个页签是白底芯片不是黑块；卡片 10px 发丝边。npm test 89 通过。不重启。',
  0,
  'success',
  1,
  0,
  '2026-09-07 13:09:44',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:12:51',
  '2026-09-07 13:12:51',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/releases.css、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 3 个路径 -> /var/lib/mengkai/snapshots/rel-56
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/releases.css -> /opt/mengkai/public/releases.css
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-56/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-57',
  '0.1.30-stage-contents',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '交单可带 contents 或 ref，先写入源目录；源与线上相同当场拒绝。解决各板块只 push git、点通过却报完全相同。',
  '["src/modules/releases/stage.js", "src/modules/releases/charter.js", "src/modules/releases/push.js", "src/modules/releases/router.js", "src/modules/releases/store-memory.js", "src/modules/releases/store-mysql.js", "public/releases.html", "test/releases.test.js"]',
  '交相同字节应 409；带 contents 或 ref 后源目录更新；点通过才拷到线上。npm test 92 通过。改了 src，需重启。',
  1,
  'success',
  1,
  0,
  '2026-09-07 13:17:29',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:19:11',
  '2026-09-07 13:19:11',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/stage.js、src/modules/releases/charter.js、src/modules/releases/push.js、src/modules/releases/router.js、src/modules/releases/store-memory.js、src/modules/releases/store-mysql.js、public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull
升级前快照 7 个路径 -> /var/lib/mengkai/snapshots/rel-57
copied src/modules/releases/stage.js -> /opt/mengkai/src/modules/releases/stage.js
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied src/modules/releases/push.js -> /opt/mengkai/src/modules/releases/push.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied src/modules/releases/store-memory.js -> /opt/mengkai/src/modules/releases/store-memory.js
copied src/modules/releases/store-mysql.js -> /opt/mengkai/src/modules/releases/store-mysql.js
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-57/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-58',
  '0.1.31-shared-layout-css-shared-nav-js',
  '独立 Agent「人员管理」',
  '独立 Agent「人员管理」',
  '人员管理',
  '人员管理页去掉自制侧栏和旧青绿主题，只留右侧名册内容，交给 /shared/layout.css 与 /shared/nav.js 注入星脉左栏+顶栏，避免和全站壳叠两套导航。',
  '["public/people.html"]',
  '登录后打开 http://zx.xingmaierp.cc/people ：只有一套星脉左侧导航和顶栏「人员管理」，右侧名册与首页/数据中心同皮肤。表格仍有沈子晗、韩梦凯、管理员（演示），可新增一条。不要再出现自制青绿侧栏或双导航。',
  0,
  'success',
  1,
  0,
  '2026-09-07 13:24:19',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:25:01',
  '2026-09-07 13:25:01',
  '按发布文档发版（模块 人员管理）。已推送：public/people.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-58
copied public/people.html -> /opt/mengkai/public/people.html
落地回执 /var/lib/mengkai/snapshots/rel-58/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-59',
  '0.1.32-theme',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '全站 Cursor 暗色 + 浅色/暗色切换。壳拥有整页外观：html[data-theme] 与 --xm-* 同时罩住侧栏、打开的内容区、登录页。选择存 xm-theme。git cursor/cursor-theme-63da 01822d6。未改版本发布中心页面，避免覆盖线上 contents/ref 闸门。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/login.css", "public/login.html", "src/modules/profile/middleware.js"]',
  '打开 /login 右上角可切浅/暗；登录后顶栏同一按钮；侧栏打开数据中心/韩梦凯/发布中心，内容区和壳同色，无蓝灰 Ant。刷新后主题还在。',
  1,
  'success',
  1,
  0,
  '2026-09-07 13:39:01',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:53:39',
  '2026-09-07 14:00:46',
  '已回滚到升级前快照。restored public/shared/layout.css
restored public/shared/nav.js
restored public/login.css
restored public/login.html
restored src/modules/profile/middleware.js 已按快照回滚文件。 回滚结果已先落盘，随后重启。 版本号仍记为 0.1.32-theme，下一条不会自动发。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-60',
  '0.1.32-shell-perf',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '修侧栏卡顿：页内切换、Node keepalive 65s、壳资源 ?v=0.1.33 甩掉缓存的 0.1.19、去掉每次点击清 10 万 timer。顺带落地浅/暗色。只带 contents，不带 gitRef。未改版本发布中心页面。',
  '["public/shared/layout.css", "public/shared/nav.js", "public/login.css", "public/login.html", "src/server.js", "src/modules/profile/middleware.js", "src/modules/home/pages.js"]',
  '登录后点韩梦凯/数据中心是页内切换，不再整页刷 CSS/JS。空闲 6 秒再点不应卡满约 5 秒。顶栏可切浅/暗。',
  1,
  'success',
  1,
  0,
  '2026-09-07 13:45:28',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:46:37',
  '2026-09-07 13:46:38',
  '按发布文档发版（模块 首页）。已推送：public/shared/layout.css、public/shared/nav.js、public/login.css、public/login.html、src/server.js、src/modules/profile/middleware.js、src/modules/home/pages.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 7 个路径 -> /var/lib/mengkai/snapshots/rel-60
copied public/shared/layout.css -> /opt/mengkai/public/shared/layout.css
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/login.css -> /opt/mengkai/public/login.css
copied public/login.html -> /opt/mengkai/public/login.html
copied src/server.js -> /opt/mengkai/src/server.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
落地回执 /var/lib/mengkai/snapshots/rel-60/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-61',
  '0.1.33-xingmai-prefix',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  'ref 拉 GitHub 时自动对 apps/xingmai/ 前缀；点通过若源目录已有文件，404 不再整单失败。修 rel-59 主题皮肤 404。',
  '["src/modules/releases/stage.js", "src/modules/releases/router.js", "test/releases.test.js"]',
  'public/shared/layout.css@主题分支应落到 apps/xingmai/ 下那份。npm test 94 通过。改了 src，需重启。',
  1,
  'success',
  1,
  0,
  '2026-09-07 13:46:39',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:47:32',
  '2026-09-07 13:47:32',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/stage.js、src/modules/releases/router.js、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 3 个路径 -> /var/lib/mengkai/snapshots/rel-61
copied src/modules/releases/stage.js -> /opt/mengkai/src/modules/releases/stage.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-61/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-62',
  '0.1.34-requeue-failed',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '失败且未落地的单据可恢复待审批。主脑口令：恢复 rel-59 审批。',
  '["src/modules/releases/charter.js", "src/modules/releases/store-memory.js", "src/modules/releases/store-mysql.js", "src/modules/releases/router.js", "test/releases.test.js"]',
  'POST /api/releases/rel-59/requeue 后队首为 rel-59。npm test 95 通过。改了 src，需重启。',
  1,
  'success',
  1,
  0,
  '2026-09-07 13:51:15',
  NULL,
  NULL,
  NULL,
  '2026-09-07 13:51:31',
  '2026-09-07 13:51:32',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/charter.js、src/modules/releases/store-memory.js、src/modules/releases/store-mysql.js、src/modules/releases/router.js、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-62
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied src/modules/releases/store-memory.js -> /opt/mengkai/src/modules/releases/store-memory.js
copied src/modules/releases/store-mysql.js -> /opt/mengkai/src/modules/releases/store-mysql.js
copied src/modules/releases/router.js -> /opt/mengkai/src/modules/releases/router.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-62/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-63',
  '0.1.35-viewport',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '通过遮罩钉回 viewport，避免侧栏壳把遮罩卷出视野；失败时遮罩留着并恢复按钮。',
  '["public/releases.html", "test/releases.test.js"]',
  '点通过后无论待上线滚到哪里都能看到「正在升级」遮罩；健康检查失败时遮罩不消失、通过按钮恢复可点。',
  0,
  'success',
  1,
  0,
  '2026-09-07 14:01:25',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:06:32',
  '2026-09-07 14:06:32',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-63
copied public/releases.html -> /opt/mengkai/public/releases.html
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-63/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-64',
  '0.1.36-theme-pages',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '不重发 rel-59 主题包。middleware 与 home/pages.js 成套：导出 readThemedHtml；pages 不再命名导入，缺函数时退回 withSharedShell，避免只换 middleware 把站打挂。',
  '["src/modules/profile/middleware.js", "src/modules/home/pages.js"]',
  '进程能起来。打开 / /data /han 都是 200。不要只发其中一份。',
  1,
  'success',
  1,
  0,
  '2026-09-07 14:07:32',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:11:28',
  '2026-09-07 14:11:28',
  '按发布文档发版（模块 首页）。已推送：src/modules/profile/middleware.js、src/modules/home/pages.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-64
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
落地回执 /var/lib/mengkai/snapshots/rel-64/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-65',
  '0.1.37-src',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '改 src 落地后、重启前试载被改模块及其调用方；缺导出则按快照收回，不重启。',
  '["src/modules/releases/smoke.js", "src/modules/releases/push.js", "src/modules/releases/charter.js", "test/releases.test.js"]',
  '再交一张丢掉 readThemedHtml 的 middleware 单，通过后应失败且站点仍 200，不会 502。',
  1,
  'success',
  2,
  0,
  '2026-09-07 14:08:54',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:11:38',
  '2026-09-07 14:11:38',
  '按发布文档发版（模块 版本发布中心）。已推送：src/modules/releases/smoke.js、src/modules/releases/push.js、src/modules/releases/charter.js、test/releases.test.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 3 个路径 -> /var/lib/mengkai/snapshots/rel-65
copied src/modules/releases/smoke.js -> /opt/mengkai/src/modules/releases/smoke.js
copied src/modules/releases/push.js -> /opt/mengkai/src/modules/releases/push.js
copied src/modules/releases/charter.js -> /opt/mengkai/src/modules/releases/charter.js
copied test/releases.test.js -> /opt/mengkai/test/releases.test.js
落地回执 /var/lib/mengkai/snapshots/rel-65/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-66',
  '0.1.38-theme-pages',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '不重发主题包。成套两份：middleware.js 导出 readThemedHtml；home/pages.js 命名空间导入，缺函数退回 withSharedShell。文件头有 xm-theme-pages-pair 0.1.38。',
  '["src/modules/profile/middleware.js", "src/modules/home/pages.js"]',
  '待上线能看到这两份 src。middleware 含 export function readThemedHtml。pages 含 profileShell.readThemedHtml。打开 / /data /han 为 200。',
  1,
  'success',
  1,
  0,
  '2026-09-07 14:15:50',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:17:26',
  '2026-09-07 14:17:27',
  '按发布文档发版（模块 首页）。已推送：src/modules/profile/middleware.js、src/modules/home/pages.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-66
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
重启前试载通过 4 个模块
落地回执 /var/lib/mengkai/snapshots/rel-66/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-67',
  '0.1.39-is-pending',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '升级失败后遮罩可关闭；本页不受主题壳 is-pending 禁点击。',
  '["public/releases.html"]',
  '硬刷新后，失败遮罩有「关闭」；主题壳 pending 时本页按钮仍能点。',
  0,
  'success',
  1,
  0,
  '2026-09-07 14:21:39',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:23:01',
  '2026-09-07 14:23:01',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-67
copied public/releases.html -> /opt/mengkai/public/releases.html
落地回执 /var/lib/mengkai/snapshots/rel-67/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-68',
  '0.1.40-full-lag',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '全面修卡：首页不再被 static 裸吐；未带 ?v= 的壳资源 must-revalidate；工作台卡片也走 SPA；HTML 读盘 5s 缓存。只带 contents，不带 gitRef。不覆盖线上 src/app.js。middleware 与 pages.js 成套，仍导出 readThemedHtml。',
  '["public/index.html", "public/shared/nav.js", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '登录后 GET / 含 nav.js?v=0.1.40，不再是裸 index.html。点工作台韩梦凯卡片不整页刷新。未带 ?v= 的 /shared/nav.js 为 must-revalidate。/api/han/tasks 与发布中心仍 200。',
  1,
  'success',
  1,
  0,
  '2026-09-07 14:31:40',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:35:15',
  '2026-09-07 14:35:17',
  '按发布文档发版（模块 首页）。已推送：public/index.html、public/shared/nav.js、src/modules/home/pages.js、src/modules/profile/middleware.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 4 个路径 -> /var/lib/mengkai/snapshots/rel-68
copied public/index.html -> /opt/mengkai/public/index.html
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
重启前试载通过 4 个模块
落地回执 /var/lib/mengkai/snapshots/rel-68/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-69',
  '0.1.41-lag-risks',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '继续收卡顿风险：SPA 进出发布中心不再叠 setInterval；连点中止未完成 HTML；预热时不悬停预取；releases 最后预热；25s ping /api/health 保活。middleware/pages 成套：已注入 HTML 不再二次加工，缓存 60s，静态 css/js 免登录查找。个人中心 30s 内不重复打 /api/auth/me。只带 contents，不带 gitRef，不覆盖 app.js/auth.js/闸门页。',
  '["public/index.html", "public/shared/nav.js", "public/me.html", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  'GET / 含 nav.js?v=0.1.41。多次进出版本发布中心，顶栏时钟仍一秒一跳。未登录 GET /releases.css 为 200。/api/han/tasks 与发布中心仍 200。',
  1,
  'success',
  1,
  0,
  '2026-09-07 14:45:30',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:51:18',
  '2026-09-07 14:51:19',
  '按发布文档发版（模块 首页）。已推送：public/index.html、public/shared/nav.js、public/me.html、src/modules/home/pages.js、src/modules/profile/middleware.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-69
copied public/index.html -> /opt/mengkai/public/index.html
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/me.html -> /opt/mengkai/public/me.html
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
重启前试载通过 4 个模块
落地回执 /var/lib/mengkai/snapshots/rel-69/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-70',
  '0.1.42-script-scope',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '补 rel-69：页内脚本用 IIFE 包一层再执行。发布中心顶层 const 在 SPA 第二次进入会报已声明，定时器被清掉却建不回来。只带 contents。middleware/pages 成套把壳版本升到 0.1.42，避免 69 的 immutable 缓存把旧 nav 留一天。',
  '["public/index.html", "public/shared/nav.js", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '必须先通过队首 0.1.41-lag-risks。本单通过后 GET / 含 nav.js?v=0.1.42。离开再进版本发布中心，待上线仍能刷新，时钟仍一秒一跳。',
  1,
  'failed',
  2,
  0,
  '2026-09-07 14:49:30',
  NULL,
  NULL,
  NULL,
  '2026-09-07 14:51:40',
  '2026-09-07 14:51:40',
  '发版失败：源目录文件与线上完全相同，没有可落地的变更。闸门只把源目录拷到线上，不读 GitHub，也不拉 Cloud 工作区。交单请带 contents（路径→正文）或 ref（分支/提交），或先把新文件写进源目录。 stderr: 源目录文件与线上完全相同，没有可落地的变更。闸门只把源目录拷到线上，不读 GitHub，也不拉 Cloud 工作区。交单请带 contents（路径→正文）或 ref（分支/提交），或先把新文件写进源目录。 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-71',
  '0.1.42-nosider',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '整块扔掉左侧栏。只留顶栏（星脉回工作台、页签、时钟、浅/暗、退出）和工作台卡片进各模块。卡片仍页内切换。只带 contents，不带 gitRef。middleware 与 pages 成套。',
  '["public/index.html", "public/shared/nav.js", "public/shared/layout.css", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '登录后没有左侧导航。工作台点韩梦凯不整页刷。顶栏星脉回到工作台。GET / 含 nav.js?v=0.1.42-nosider。',
  1,
  'success',
  1,
  0,
  '2026-09-07 14:58:17',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:00:01',
  '2026-09-07 15:01:43',
  '已回滚到升级前快照。restored public/index.html
restored public/shared/nav.js
restored public/shared/layout.css
restored src/modules/home/pages.js
restored src/modules/profile/middleware.js 已按快照回滚文件。 回滚结果已先落盘，随后重启。 版本号仍记为 0.1.42-nosider，下一条不会自动发。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-72',
  '0.1.43-remain-lag',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '韩梦凯 GET /api/han/tasks 与 /api/han/brief 缓存 2.5 秒；登录和改密改为异步 scrypt。侧栏未动。',
  '["public/index.html", "public/shared/nav.js", "src/modules/home/pages.js", "src/modules/profile/middleware.js", "src/modules/profile/auth.js"]',
  '侧栏仍在且仍是 7 个入口；罗成 / ChangeMe123! 能登录；同一会话连续请求 /api/han/tasks 第二次带 X-Xm-Cache: han 或明显更快；韩梦凯写操作后缓存失效。',
  1,
  'success',
  1,
  0,
  '2026-09-07 15:14:14',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:15:35',
  '2026-09-07 15:15:36',
  '按发布文档发版（模块 首页）。已推送：public/index.html、public/shared/nav.js、src/modules/home/pages.js、src/modules/profile/middleware.js、src/modules/profile/auth.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-72
copied public/index.html -> /opt/mengkai/public/index.html
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
copied src/modules/profile/auth.js -> /opt/mengkai/src/modules/profile/auth.js
重启前试载通过 5 个模块
落地回执 /var/lib/mengkai/snapshots/rel-72/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-73',
  '0.1.44-upgrade-mask',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '版本发布中心',
  '升级遮罩不再卡在「正在升级」；关闭按钮钉在卡片右上角。侧栏挂壳不再把遮罩塞进内容区。',
  '["public/releases.html", "public/shared/nav.js", "public/index.html", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '通过后遮罩标题变为升级完成或升级未完成，关闭在卡片右上角可点。浏览器刷新后旧遮罩消失。侧栏仍在。',
  1,
  'success',
  1,
  0,
  '2026-09-07 15:22:25',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:23:09',
  '2026-09-07 15:23:13',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/shared/nav.js、public/index.html、src/modules/home/pages.js、src/modules/profile/middleware.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-73
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/index.html -> /opt/mengkai/public/index.html
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
重启前试载通过 4 个模块
落地回执 /var/lib/mengkai/snapshots/rel-73/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-74',
  '0.1.45-overlay-visible',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '版本发布中心',
  '点通过后立刻打开升级遮罩。遮罩挂到 html，不再拿被卸掉的旧节点。',
  '["public/releases.html", "public/shared/nav.js", "public/index.html", "src/modules/home/pages.js", "src/modules/profile/middleware.js"]',
  '点队首通过后立刻出现整页遮罩，标题为正在升级或升级完成/未完成，关闭在卡片右上角。',
  1,
  'success',
  1,
  0,
  '2026-09-07 15:30:57',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:31:42',
  '2026-09-07 15:31:43',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/shared/nav.js、public/index.html、src/modules/home/pages.js、src/modules/profile/middleware.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 5 个路径 -> /var/lib/mengkai/snapshots/rel-74
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/shared/nav.js -> /opt/mengkai/public/shared/nav.js
copied public/index.html -> /opt/mengkai/public/index.html
copied src/modules/home/pages.js -> /opt/mengkai/src/modules/home/pages.js
copied src/modules/profile/middleware.js -> /opt/mengkai/src/modules/profile/middleware.js
重启前试载通过 4 个模块
落地回执 /var/lib/mengkai/snapshots/rel-74/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-75',
  '0.1.46-ship',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '升级后会话还在则自动刷新；掉登录时遮罩停住请登录完结，不自动跳登录。遮罩样式改进行表，侧栏跳转也能看见。',
  '["public/releases.html", "public/releases.css"]',
  '不掉登录的通过仍自动刷新完结。掉登录时出现「去登录完结」，不自动跳 /login；登录后再打开本页提示登录已完结。',
  0,
  'success',
  1,
  0,
  '2026-09-07 15:35:04',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:36:38',
  '2026-09-07 15:36:38',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/releases.css。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-75
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/releases.css -> /opt/mengkai/public/releases.css
落地回执 /var/lib/mengkai/snapshots/rel-75/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-76',
  '0.1.47-home-cards',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '删掉工作台里和左侧栏重复的 7 张模块入口卡。侧栏保留，首页只留工作台说明。只带 contents，不带 gitRef。不重启。',
  '["public/index.html"]',
  '登录后打开 / ，没有「模块入口」卡片网格；左侧栏仍是 7 项，点数据中心/韩梦凯等能进模块。',
  0,
  'success',
  1,
  0,
  '2026-09-07 15:37:30',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:41:38',
  '2026-09-07 15:41:38',
  '按发布文档发版（模块 首页）。已推送：public/index.html。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 1 个路径 -> /var/lib/mengkai/snapshots/rel-76
copied public/index.html -> /opt/mengkai/public/index.html
落地回执 /var/lib/mengkai/snapshots/rel-76/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-77',
  '0.1.48-html-spa',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '遮罩每次从文档重新取节点并挂到 html，避免主题 SPA 删旧节点后改到空节点上。',
  '["public/releases.html", "public/releases.css"]',
  '从侧栏进发布中心再点通过，整页应出现升级遮罩。',
  0,
  'success',
  2,
  0,
  '2026-09-07 15:40:52',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:42:01',
  '2026-09-07 15:42:01',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/releases.css。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-77
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/releases.css -> /opt/mengkai/public/releases.css
落地回执 /var/lib/mengkai/snapshots/rel-77/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-78',
  '0.1.49-history-logs',
  '版本发布中心',
  '版本发布中心',
  '版本发布中心',
  '主题壳 SPA 换页后重新拉取并写入当前页的版本记录/运行日志，避免残留空节点和页签空白。',
  '["public/releases.html", "public/releases.css"]',
  '登录后打开 /releases，点「版本记录」应看到成功发布表格，点「运行日志」应看到发版流水。从首页点回本页后再点这两个页签，内容仍在。待上线空队列提示不变。',
  0,
  'success',
  1,
  0,
  '2026-09-07 15:53:45',
  NULL,
  NULL,
  NULL,
  '2026-09-07 15:59:55',
  '2026-09-07 15:59:55',
  '按发布文档发版（模块 版本发布中心）。已推送：public/releases.html、public/releases.css。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-78
copied public/releases.html -> /opt/mengkai/public/releases.html
copied public/releases.css -> /opt/mengkai/public/releases.css
落地回执 /var/lib/mengkai/snapshots/rel-78/apply-receipt.json
本机落地完成（未重启） 文档要求不重启，已跳过 systemctl。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-79',
  '0.1.50-mysql',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '各中心业务数据落到共用 MySQL（韩梦凯/沈子晗任务日报、人员、数据看板、笔记、登录用户）。会话仍内存。不覆盖 app.js 和发布中心闸门仓库。只带 contents，不带 gitRef。需重启；package.json 已加 mysql2，通过后在 /opt/mengkai 执行 npm install。',
  '["src/db/pool.js", "src/db/boot.js", "src/db/schema.sql", "src/modules/han/store.js", "src/modules/han/router.js", "src/modules/han/index.js", "src/modules/shen/store.js", "src/modules/shen/router.js", "src/modules/people/store.js", "src/modules/people/router.js", "src/modules/data/overview.js", "src/modules/data/router.js", "src/notes-store.js", "src/modules/profile/auth.js", "src/server.js", "package.json"]',
  'ECS 已开 MySQL 并配 MYSQL_*（默认 127.0.0.1/xingmai）。通过后加韩梦凯任务、改个人资料，再重启仍在。连不上库时进程先用内存启动。发布中心队列不受影响。',
  1,
  'failed',
  2,
  0,
  '2026-09-07 15:58:14',
  NULL,
  NULL,
  NULL,
  '2026-09-07 16:01:57',
  '2026-09-07 16:01:58',
  '发版失败：EACCES, Permission denied \'/opt/mengkai/src/db/pool.js\' code=EACCES 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-80',
  '0.1.50-mysql-eacces',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '补 rel-79：不再新建 src/db。连接池写进已有 auth.js，启动写进已有 notes-store.js。只覆盖线上已有文件。只带 contents，不带 gitRef。需重启并 npm install mysql2。',
  '["src/modules/profile/auth.js", "src/notes-store.js", "src/server.js", "src/modules/han/store.js", "src/modules/han/router.js", "src/modules/shen/store.js", "src/modules/shen/router.js", "src/modules/people/store.js", "src/modules/people/router.js", "src/modules/data/overview.js", "src/modules/data/router.js", "package.json"]',
  '通过不再报 EACCES。韩梦凯加任务、改个人资料后重启仍在（MySQL 已开时）。连不上库先用内存。发布中心不受影响。',
  1,
  'failed',
  1,
  0,
  '2026-09-07 16:06:56',
  NULL,
  NULL,
  NULL,
  '2026-09-07 16:08:19',
  '2026-09-07 16:08:20',
  '发版失败：重启前试载失败，已按快照收回，未重启进程。SyntaxError: The requested module \'./notes-store.js\' does not provide an export named \'createNotesStore\' code=SMOKE_IMPORT_ERROR stderr: 重启前试载失败，已按快照收回，未重启进程。
file:///opt/mengkai/src/app.js:12
import { createNotesStore } from "./notes-store.js";
         ^^^^^^^^^^^^^^^^
SyntaxError: The requested module \'./notes-store.js\' does not provide an export named \'createNotesStore\'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:226:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:335:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async file:///opt/mengkai/[eval1]:7:3

Node.js v22.23.2 stdout: 本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 12 个路径 -> /var/lib/mengkai/snapshots/rel-80
copied src/modules/profile/auth.js -> /opt/mengkai/src/modules/profile/auth.js
copied src/notes-store.js -> /opt/mengkai/src/notes-store.js
copied src/server.js -> /opt/mengkai/src/server.js
copied src/modules/han/store.js -> /opt/mengkai/src/modules/han/store.js
copied src/modules/han/router.js -> /opt/mengkai/src/modules/han/router.js
copied src/modules/shen/store.js -> /opt/mengkai/src/modules/shen/store.js
copied src/modules/shen/router.js -> /opt/mengkai/src/modules/shen/router.js
copied src/modules/people/store.js -> /opt/mengkai/src/modules/people/store.js
copied src/modules/people/router.js -> /opt/mengkai/src/modules/people/router.js
copied src/modules/data/overview.js -> /opt/mengkai/src/modules/data/overview.js
copied src/modules/data/router.js -> /opt/mengkai/src/modules/data/router.js
copied package.json -> /opt/mengkai/package.json
试载失败，已按快照收回线上文件
重启前试载失败，已按快照收回，未重启进程。
file:///opt/mengkai/src/app.js:12
import { createNotesStore } from "./notes-store.js";
         ^^^^^^^^^^^^^^^^
SyntaxError: The requested module \'./notes-store.js\' does not provide an export named \'createNotesStore\'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:226:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:335:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async file:///opt/mengkai/[eval1]:7:3

Node.js v22.23.2 已释放发布锁。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-81',
  '0.1.50-mysql-notes',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '补 rel-80：notes-store 保留线上 createNotesStore().list/.create，试载才能过。连接池仍在已有 auth.js。mysql2 改为连库时再加载。只覆盖已有文件，不带 gitRef。需重启。',
  '["src/modules/profile/auth.js", "src/notes-store.js", "src/server.js", "src/modules/han/store.js", "src/modules/han/router.js", "src/modules/shen/store.js", "src/modules/shen/router.js", "src/modules/people/store.js", "src/modules/people/router.js", "src/modules/data/overview.js", "src/modules/data/router.js", "package.json"]',
  '试载不再报 createNotesStore。通过后加笔记/韩梦凯任务，MySQL 开着时重启还在。',
  1,
  'success',
  1,
  0,
  '2026-09-07 16:10:14',
  NULL,
  NULL,
  NULL,
  '2026-09-07 16:10:47',
  '2026-09-07 16:10:48',
  '按发布文档发版（模块 首页）。已推送：src/modules/profile/auth.js、src/notes-store.js、src/server.js、src/modules/han/store.js、src/modules/han/router.js、src/modules/shen/store.js、src/modules/shen/router.js、src/modules/people/store.js、src/modules/people/router.js、src/modules/data/overview.js、src/modules/data/router.js、package.json。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 12 个路径 -> /var/lib/mengkai/snapshots/rel-81
copied src/modules/profile/auth.js -> /opt/mengkai/src/modules/profile/auth.js
copied src/notes-store.js -> /opt/mengkai/src/notes-store.js
copied src/server.js -> /opt/mengkai/src/server.js
copied src/modules/han/store.js -> /opt/mengkai/src/modules/han/store.js
copied src/modules/han/router.js -> /opt/mengkai/src/modules/han/router.js
copied src/modules/shen/store.js -> /opt/mengkai/src/modules/shen/store.js
copied src/modules/shen/router.js -> /opt/mengkai/src/modules/shen/router.js
copied src/modules/people/store.js -> /opt/mengkai/src/modules/people/store.js
copied src/modules/people/router.js -> /opt/mengkai/src/modules/people/router.js
copied src/modules/data/overview.js -> /opt/mengkai/src/modules/data/overview.js
copied src/modules/data/router.js -> /opt/mengkai/src/modules/data/router.js
copied package.json -> /opt/mengkai/package.json
重启前试载通过 14 个模块
落地回执 /var/lib/mengkai/snapshots/rel-81/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
INSERT INTO release_tickets (
  id, version, applicant, source, module, summary, files, acceptance, restart,
  status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
  publish_started_at, publish_finished_at, log
) VALUES (
  'rel-82',
  '0.1.51-clean-probe',
  '罗成运营部主脑',
  '罗成运营部主脑',
  '首页',
  '删掉验收留下的试探笔记和韩梦凯任务 probe-1788797612。只改已有文件，保留 createNotesStore。只带 contents，不带 gitRef。需重启。',
  '["src/notes-store.js", "src/modules/han/store.js"]',
  '重启后 /api/notes 和 /api/han/tasks 里没有 probe-1788797612。',
  1,
  'success',
  1,
  0,
  '2026-09-07 16:17:13',
  NULL,
  NULL,
  NULL,
  '2026-09-07 16:20:33',
  '2026-09-07 16:20:34',
  '按发布文档发版（模块 首页）。已推送：src/notes-store.js、src/modules/han/store.js。本机落地 live=/opt/mengkai source=/var/lib/mengkai/source
未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。
升级前快照 2 个路径 -> /var/lib/mengkai/snapshots/rel-82
copied src/notes-store.js -> /opt/mengkai/src/notes-store.js
copied src/modules/han/store.js -> /opt/mengkai/src/modules/han/store.js
重启前试载通过 5 个模块
落地回执 /var/lib/mengkai/snapshots/rel-82/apply-receipt.json
本机落地完成（未重启） 成功状态已先落盘，随后重启线上进程。 公网验收：打开 http://zx.xingmaierp.cc/ 看对应模块。队列下一条不会自动发布。'
);
