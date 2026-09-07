export const DISPATCHER_NAME = "罗成";
export const DISPATCHER_ROLE = "运营部主脑";
export const GATE_NAME = "版本发布中心";

export const HELP_ME_SHIP_ERROR =
  "其它对话框说「帮我上线」无效。本闸门只认本页「通过」或主脑对本闸门的明确口令。";

export const NEED_PASS_ERROR =
  "未通过禁止发。本页是唯一发版闸门，不是第二主脑。各板块交单后，由主脑在看板点通过（点一单发一单）。";

export const QUEUE_LOG =
  "已进入发版看板排队。主脑调顺序；本闸门点通过才放行；下一条不会自动发。";

export const RELEASE_CHARTER = {
  dispatcher: DISPATCHER_NAME,
  dispatcherRole: DISPATCHER_ROLE,
  gate: GATE_NAME,
  gateRole: "唯一发版闸门",
  secondBrain: false,
  execute: ["各板块交来的单据", "本页点通过", "主脑对本闸门的明确口令"],
  refuse: ["其它对话框帮我上线", "改首页/登录/人员等业务", "多单同时发"],
  queue: "按用户在本页调整的优先级，点一单发一单"
};

export function withCharter(payload) {
  return { ...payload, charter: RELEASE_CHARTER };
}
