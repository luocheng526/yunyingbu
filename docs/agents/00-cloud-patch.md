【撤销本地 worker——改回 Cursor Cloud】

上一份「必须跑在 aliyun-ecs 本机」作废。你继续在 Cursor Cloud 上工作，不要选 My Machines。

【代码位置】仓库里的 apps/xingmai/ （对应生产 /opt/mengkai）。只改你负责的模块目录和对应 public/*.html。

【怎么上服务器】不要自己 SSH、不要 systemctl restart。改完 git 提交/推送，到版本发布中心提交发布申请，等主脑审核并点击发布。

【验收】在 Cloud 里 npm test 或对本模块文件做静态检查即可。公网站点 zx.xingmaierp.cc 需要安全组放行 80 后才能浏览器验收。

若 hostname 是 ecs-bj-erp，说明你误跑在服务器 worker 上，停下来改回 Cloud。
