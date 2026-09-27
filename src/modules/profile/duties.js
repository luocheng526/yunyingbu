/**
 * 责权总表。新增责权只往 CATALOG 里加一条，或调用 registerDuty。
 * 页面按 group 分组渲染；granted 由账号上的 dutyIds 决定。
 */
const INITIAL = [
  { id: "data.enter", group: "数据中心", label: "进入数据中心" },
  { id: "data.overview", group: "数据中心", label: "查看数据总揽" },
  { id: "data.shop", group: "数据中心", label: "查看店铺数据" },
  { id: "data.goods", group: "数据中心", label: "查看商品数据" },
  { id: "data.paid", group: "数据中心", label: "查看实时付费" },
  { id: "shen.enter", group: "沈子晗运营中心", label: "进入沈子晗运营中心" },
  { id: "shen.selection", group: "沈子晗运营中心", label: "查看选品中心" },
  { id: "shen.growth", group: "沈子晗运营中心", label: "查看商品成长" },
  { id: "shen.paid", group: "沈子晗运营中心", label: "查看实时付费" },
  { id: "shen.training", group: "沈子晗运营中心", label: "查看培训系统" },
  { id: "shen.tasks", group: "沈子晗运营中心", label: "查看任务管理" },
  { id: "han.enter", group: "韩梦凯运营中心", label: "进入韩梦凯运营中心" },
  { id: "han.selection", group: "韩梦凯运营中心", label: "查看选品数据" },
  { id: "han.goods", group: "韩梦凯运营中心", label: "查看商品数据" },
  { id: "han.paid", group: "韩梦凯运营中心", label: "查看实时付费" },
  { id: "han.training", group: "韩梦凯运营中心", label: "查看培训系统" },
  { id: "academy.enter", group: "甄选商学院", label: "进入甄选商学院" },
  { id: "academy.catalog", group: "甄选商学院", label: "查看课程目录" },
  { id: "academy.progress", group: "甄选商学院", label: "记录学习进度" },
  { id: "agents.enter", group: "甄选智能体", label: "进入甄选智能体" },
  { id: "agents.chat", group: "甄选智能体", label: "使用对话" },
  { id: "agents.connect", group: "甄选智能体", label: "配置接入" },
  { id: "releases.enter", group: "版本发布中心", label: "进入版本发布中心" },
  { id: "releases.view", group: "版本发布中心", label: "查看待上线" },
  { id: "releases.submit", group: "版本发布中心", label: "提交发版单" },
  { id: "releases.pass", group: "版本发布中心", label: "通过发版" },
  { id: "org.enter", group: "组织中心", label: "进入组织中心" },
  { id: "org.stores", group: "组织中心", label: "查看店铺主数据" },
  { id: "org.stores.edit", group: "组织中心", label: "编辑店铺主数据" },
  { id: "org.members", group: "组织中心", label: "查看成员" },
  { id: "me.enter", group: "个人中心", label: "进入个人中心" },
  { id: "me.password", group: "个人中心", label: "修改密码" },
  { id: "me.duties", group: "个人中心", label: "查看责权清单" }
];

const CATALOG = INITIAL.map((item) => ({ ...item }));

function cloneItem(item) {
  return { id: item.id, group: item.group, label: item.label };
}

export function listDutyCatalog() {
  return CATALOG.map(cloneItem);
}

export function allDutyIds() {
  return CATALOG.map((item) => item.id);
}

export function registerDuty({ id, group, label }) {
  const dutyId = String(id || "").trim();
  const dutyGroup = String(group || "").trim();
  const dutyLabel = String(label || "").trim();
  if (!dutyId || !dutyGroup || !dutyLabel) {
    return { ok: false, error: "请填写责权 id、分组和名称" };
  }
  const existing = CATALOG.find((item) => item.id === dutyId);
  if (existing) {
    existing.group = dutyGroup;
    existing.label = dutyLabel;
    return { ok: true, item: cloneItem(existing), updated: true };
  }
  const item = { id: dutyId, group: dutyGroup, label: dutyLabel };
  CATALOG.push(item);
  return { ok: true, item: cloneItem(item), updated: false };
}

export function resetDutyCatalogForTests() {
  CATALOG.splice(0, CATALOG.length, ...INITIAL.map((item) => ({ ...item })));
}

export function buildDutyView(grantedIds) {
  const grantAll = grantedIds === "*" || grantedIds === true;
  const granted = new Set(Array.isArray(grantedIds) ? grantedIds : []);
  const groups = [];
  const index = new Map();
  for (const item of CATALOG) {
    let group = index.get(item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      index.set(item.group, group);
      groups.push(group);
    }
    const isGranted = grantAll || granted.has(item.id);
    group.items.push({ id: item.id, label: item.label, granted: isGranted });
  }
  const grantedCount = groups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.granted).length,
    0
  );
  return { grantedCount, total: CATALOG.length, groups };
}
