export const PLAN = [
  {
    step: 1,
    current: false,
    name: "三格框架",
    detail: "培训课程 / 培训考试 / 运营手册先铺开，后面再往里填。"
  },
  {
    step: 2,
    current: true,
    name: "培训课程",
    detail: "导入 PPT，学员只能在线翻页，不能下载原件，截图带水印。"
  },
  {
    step: 3,
    current: false,
    name: "培训考试",
    detail: "先选晋升档再出卷，限时交卷。"
  },
  {
    step: 4,
    current: false,
    name: "运营手册",
    detail: "一节一节写，有分支，可插图。"
  }
];

export const EXAM_TRACKS = [
  { id: "newbie", name: "新人考试", from: "新人", to: "助理", minutes: 30, questions: 20, passScore: 80 },
  { id: "assistant-regular", name: "助理转正考试", from: "助理", to: "转正", minutes: 40, questions: 25, passScore: 80 },
  { id: "assistant-ops", name: "助理转运营考试", from: "助理", to: "运营", minutes: 45, questions: 30, passScore: 80 },
  { id: "ops-reserve", name: "运营转储备考试", from: "运营", to: "储备", minutes: 50, questions: 30, passScore: 85 },
  { id: "reserve-supervisor", name: "储备转主管考试", from: "储备", to: "主管", minutes: 60, questions: 35, passScore: 85 },
  { id: "supervisor-manager", name: "主管转经理考试", from: "主管", to: "经理", minutes: 60, questions: 40, passScore: 85 }
];

export const HANDBOOK_TREE = [
  {
    id: "goods",
    title: "选品与商品",
    children: [
      { id: "goods-title", title: "标题与类目" },
      { id: "goods-test", title: "测款节奏" }
    ]
  },
  {
    id: "traffic",
    title: "流量与投放",
    children: [
      { id: "traffic-search", title: "搜索自然流量" },
      { id: "traffic-ads", title: "付费投放怎么看" }
    ]
  },
  {
    id: "convert",
    title: "转化与页面",
    children: [{ id: "convert-detail", title: "详情转化点" }]
  },
  {
    id: "data",
    title: "数据与复盘",
    children: [{ id: "data-week", title: "周复盘" }]
  },
  {
    id: "promo",
    title: "大促节奏",
    children: [{ id: "promo-618", title: "618 作战" }]
  }
];

export function listCourses() {
  return {
    download: false,
    watermark: true,
    accept: [".pptx"],
    items: []
  };
}

export function listExamTracks() {
  return EXAM_TRACKS.map((item) => ({ ...item }));
}

export function getExamTrack(id) {
  const hit = EXAM_TRACKS.find((item) => item.id === String(id || ""));
  return hit ? { ...hit } : null;
}

export function handbookTree() {
  return HANDBOOK_TREE.map((item) => ({
    ...item,
    children: (item.children || []).map((child) => ({ ...child }))
  }));
}

export function plan() {
  return {
    step: 2,
    title: "第 2 步：培训课程",
    steps: PLAN.map((item) => ({ ...item }))
  };
}
