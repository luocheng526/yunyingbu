# 首页业绩：WPS 配置与发送归档

本变更在 `codex/home-wps-daily-sync` 开发。用户于 2026-11-23 授权发布上线；发布记录保存在项目根目录 `reports/home-wps-daily-sync/`。上线前已合并保留线上首页单一实时入口和同店铺环比修复。

## 页面

首页 → 近七天业绩汇总 → 右上角 **WPS 配置 / 钉钉配置 / 历史数据**。

- WPS 配置支持官方授权、账号备注、韩梦凯/沈子晗源表绑定、工作表名称、权限检查、可见行列范围、保存并立即同步。授权账号统一用于两张表。
- 账号备注不是 WPS 返回的身份信息；实际授权账号由用户在 WPS 官方页选择。只支持当前接入工具支持的个人文档账号。
- 隐藏行列尚不能自动识别。管理员须配置可见行列范围；表头/店铺行使用从 1 开始的行号，列使用 A、B、MG 等字母。可以填 `3-19,22`、`A:H,MG:NT`。读取截止登记日期列。更改账号或绑定后必须重新同步；旧快照失去发送资格。
- 历史保存发送当时的完整数据快照、列顺序、团队与底部分类汇总、PNG 原图、带表头颜色和固定行列的 XLSX。Excel 内为数值/文本，不执行来源表格中的公式。
- 历史支持日期筛选、只读表格/原图查看及 Excel/PNG 下载。同一数据版本、同一渠道和接收对象重复提交返回已有记录；数据或接收对象变化另存版本。历史不因 WPS 后续修改或服务重启而变化。

## 钉钉配置

三个独立页签均可保存、设为默认方式及检查已保存配置（不发消息）：

| 入口 | 配置 | 消息形态 |
| --- | --- | --- |
| 群机器人 Webhook | 群备注、Webhook、可选 SEC 加签密钥、安全关键词 | Markdown 中嵌入报表图片，发到该机器人所在群 |
| 应用工作通知 | 应用凭据、AgentId、接收人 userId | 原图上传钉钉媒体后，通过企业应用发送图片工作通知 |
| 应用机器人单聊 | 应用凭据、RobotCode、独立的接收人 userId | 原图上传钉钉媒体后，通过应用机器人发送单聊图片 |

应用可复用工作中心已有配置或服务器环境变量，也可手动填写 Client ID / Client Secret；机器人单聊还可复用工作通知的应用凭据。工作中心配置只读，不调用该模块的测试发送或自动降级功能。两类个人接收人各自保存，每种最多 20 位。未配置或缺少必要字段不能发送。

保存的三种配置使用 AES-256-GCM 加密，位于持久目录的 `ding-config.json`；默认加密密钥单独存于 `ding-config.key`，文件按 0600 创建。必须一起备份并限制服务器目录访问。也可通过 `HOME_WEEK_DING_KEY` 提供 Base64 编码的 32 字节密钥；更换或丢失密钥将导致旧配置无法读取。网页从不回显 Webhook、Secret 或访问令牌；密码留空保留旧值，修改 Client ID 时必须同时提供对应 Secret。

已有 `HOME_WEEK_DING_WEBHOOK` 或旧报表 Webhook 可继续使用，保存新配置后优先使用新值。旧报表写入接口不再接受 Webhook 更改，统一走管理员配置入口。旧配置文件不会自动删除。复用已有应用读取 `work_report_diary_meta` 中的 `ding_agent`，否则读取 `DINGTALK_CLIENT_ID`、`DINGTALK_CLIENT_SECRET` 和 `DINGTALK_AGENT_ID`。

凭据检查只获取应用访问令牌，不调用发消息接口。它不证明消息权限、机器人能力或人员可见范围已正确开通；这些须在钉钉开发者后台设置，并在正式联调时确认。

## 发送行为

前端固定待发送的数据版本，用这份数据生成 PNG，携带 `X-Week-Revision`；发送窗口明确选择一个渠道，并携带配置版本 `X-Week-Ding-Revision`。服务器比较两类版本，任何变化均拒绝发送，要求重新选择。不会因失败自动改发另一种渠道。

服务器先完整写入三份文件，再调用钉钉。群机器人 HTTP 成功且 `errcode === 0` 标为发送成功；工作通知返回 `task_id`、单聊返回 `processQueryKey` 时标为“钉钉已受理”，不等同于确认送达或已读。单聊返回无效/限流接收人时标为“部分接收人未通过”，保留名单和发送凭证。明确拒绝或尚未发送时失败可重试；连接超时/不明响应、部分受理和进程中断遗留的 `sending` 阻止整体重复发送，需要核对钉钉消息。当前未实现发送结果自动轮询。

群图片通过 256 位随机分享标识供钉钉读取，服务重启后继续有效；历史列表、表格和导出接口都需要登录。WPS/钉钉配置、授权、同步、发送额外要求管理员，并拒绝跨站写入。

当前变更接入“发送图片”流程；尚未增加定时自动同步、无浏览器后台出图或每日自动发送任务。本地仍禁止真实发送。

## 服务配置

| 环境变量 | 用途 |
| --- | --- |
| `HOME_WEEK_DATA_DIR` | 持久目录，默认 `${MENGKAI_LIVE_ROOT || cwd}/data/home-week`，包含配置与 `history/<id>/`；必须纳入备份，避免放入临时目录 |
| `HOME_WEEK_WPS_CONFIG` | 可选，旧配置文件路径；保留已有 `cli` 等服务端配置，网页不能更改可执行文件路径 |
| `HOME_WEEK_WPS_STORE` | 可选，WPS 当前快照路径 |
| `HOME_WEEK_WPS_CLI` | 可选，已安装的 `kdocs-cli` 可执行文件；默认从 PATH 查找 |
| `HOME_WEEK_TEST_ONLY` | 本地预览显式设为 `1` 禁止发送；正式服务器默认使用正式同步快照，仍须两组当天数据完整且来源范围已确认，发送需管理员主动操作 |
| `HOME_WEEK_ADMINS` | 逗号分隔的管理员用户名，默认 `罗成,luocheng,luocheng526` |
| `HOME_WEEK_PUBLIC_ORIGIN` | 建议部署时显式设为 `https://zx.xingmaierp.cc`，用于钉钉图片地址 |

Linux x64 服务器未配置 CLI 时，首次打开 WPS 配置会将官方 2.9.0 固定版本下载至持久目录 `tools/`，核对预先固定的 SHA-256，限提取单个可执行文件；既有 PATH/显式 CLI 配置优先。运行网站的系统用户执行授权，授权凭据由 CLI 保存。网页仅显示授权状态和官方授权链接，不返回或记录 CLI 原始输出；实际账号授权由用户在官方页面完成。

## 验证

`MENGKAI_SMOKE_LIVE=1` 下运行 `node --test test/home-week-ding.test.js test/home-week-management.test.js test/home-week-wps.test.js test/home-week-report.test.js test/api.test.js test/ui-shell.test.js test/home-client-bust.test.js`，共 40 项通过。

新增接口测试使用临时目录和假钉钉发送器，覆盖权限、跨站写入、版本过期、发送成功/失败/结果未知、重复发送、同日版本、原图一致性、只读快照、导出、凭据不外泄及配置失效处理。

本地预览 `http://127.0.0.1:8767/home`。报告目录中的 `check-management.mjs` 验证配置弹窗、授权状态、历史表格/原图、导出链接和窄屏布局；其中历史记录及授权仅为浏览器拦截的界面示例，未写入真实历史、未操作真实授权、未发送消息。

`check-ding.mjs` 验证三个入口、独立保存、应用来源切换、秘密字段不回显、检查按钮、发送渠道选择及手机布局。保存与发送均由浏览器拦截模拟，未保存假凭据、未发送真实钉钉消息。服务端测试另外验证加签、原图媒体上传、两种个人消息请求、加密持久化、接收对象去重和部分/未知结果。真实应用权限与客户端收图仍需正式联调。

接口参考：[工作通知](https://open.dingtalk.com/document/orgapp/asynchronous-sending-of-enterprise-session-messages)、[机器人单聊](https://open.dingtalk.com/document/orgapp/chatbots-send-one-on-one-chat-messages-in-batches)、[上传媒体](https://open.dingtalk.com/document/orgapp/upload-media-files)。
