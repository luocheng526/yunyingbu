export const DISPATCHER_NAME = "罗成";
export const DISPATCHER_ROLE = "运营部主脑";
export const GATE_NAME = "版本发布中心";

export const HELP_ME_SHIP_ERROR =
  "其它对话框说「帮我上线」无效。本闸门只认本页「通过」或主脑对本闸门的明确口令。";

export const NEED_PASS_ERROR =
  "未通过禁止发。本页是唯一发版闸门，不是第二主脑。各板块交单后，由主脑在看板点通过（点一单发一单）。";

export const QUEUE_LOG =
  "已按提交时间入队。先交先发，禁止上移下移和插队；点通过才放行；下一条不会自动发。";

export const REORDER_FORBIDDEN =
  "排队只按提交时间，禁止上移、下移和拖拽改序。请先处理第 1 位。";

export const INTERRUPTED_PUBLISH_LOG =
  "发布未完成：进程在落地确认前被重启打断。不能当作成功。请用新单据重试。下一条不会自动发。";

export const RECEIPT_RECOVER_LOG =
  "重启打断后发现落地回执，按已拷贝处理。请打开页面确认文件，不要自动发下一单。";

export const NOOP_APPLY_ERROR =
  "源目录文件与线上完全相同，没有可落地的变更。请先把新文件放到源目录再交单。";

export const RELEASE_CHARTER = {
  dispatcher: DISPATCHER_NAME,
  dispatcherRole: DISPATCHER_ROLE,
  gate: GATE_NAME,
  gateRole: "唯一发版闸门",
  secondBrain: false,
  execute: ["各板块交来的单据", "本页点通过", "主脑对本闸门的明确口令"],
  refuse: ["其它对话框帮我上线", "改首页/登录/人员等业务", "多单同时发", "跳过队首点通过"],
  queue: "入队按提交时间；禁止上移下移；闸门只允许通过第 1 位，点一单发一单",
  version: "字母数字和 ._- ；同模块同版本不能重复排队或再次成功发布；成功单可按快照回滚；文件只允许 public/src/test/package.json"
};

export function withCharter(payload) {
  return { ...payload, charter: RELEASE_CHARTER };
}
