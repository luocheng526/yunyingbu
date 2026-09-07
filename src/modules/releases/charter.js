export const DISPATCHER_NAME = "罗成";
export const DISPATCHER_ROLE = "运营部主脑";
export const GATE_NAME = "版本发布中心";

export const HELP_ME_SHIP_ERROR =
  "其它对话框说「帮我上线」无效。本闸门只认本页「通过」或主脑对本闸门的明确口令。";

export const NEED_PASS_ERROR =
  "未通过禁止发。本页是唯一发版闸门，不是第二主脑。各板块交单后，由主脑在看板点通过（点一单发一单）。";

export const QUEUE_LOG =
  "已按稳定顺序入队（登录/依赖 → 共享壳 → 业务 → 发布中心页）。主脑仍可上移下移；点通过才放行；下一条不会自动发。";

export const RELEASE_CHARTER = {
  dispatcher: DISPATCHER_NAME,
  dispatcherRole: DISPATCHER_ROLE,
  gate: GATE_NAME,
  gateRole: "唯一发版闸门",
  secondBrain: false,
  execute: ["各板块交来的单据", "本页点通过", "主脑对本闸门的明确口令"],
  refuse: ["其它对话框帮我上线", "改首页/登录/人员等业务", "多单同时发", "跳过队首点通过"],
  queue: "入队按稳定顺序；主脑仍可上移下移；闸门只允许通过第 1 位，点一单发一单",
  version: "字母数字和 ._- ；同模块同版本不能重复排队或再次成功发布；成功单可按快照回滚；文件只允许 public/src/test/package.json"
};

export function withCharter(payload) {
  return { ...payload, charter: RELEASE_CHARTER };
}
