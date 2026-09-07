【补丁·版本发布中心·Cloud 发版】

你也在 Cursor Cloud 上工作，不要切 My Machines。

点「发布」成功后（状态机仍要排队+审核+全局锁），真正落到 ECS 的步骤是：
1. 确保 Cloud 环境能 SSH（~/.ssh/yunyingbu_aliyun 或环境变量 ALIYUN_SSH_PRIVATE_KEY）
2. 在仓库根执行：chmod +x deploy/scripts/*.sh && ./deploy/scripts/push-xingmai-to-ecs.sh
3. 再 SSH 执行：systemctl restart mengkai.service
4. 失败则单据 failed 并释放锁；成功则 success

不要让其他模块自己 push。未审核通过禁止 push。
