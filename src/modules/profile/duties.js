/**
 * 责权总表。新增责权只往 CATALOG 里加一条，或调用 registerDuty。
 * 页面按 group 分组渲染；granted 由账号上的 dutyIds 决定。
 */
const INITIAL = [
  { id: "data.view", group: "数据看板", label: "查看数据看板" },
  { id: "data.export", group: "数据看板", label: "导出看板数据" },
  { id: "home.enter", group: "部门工作台", label: "进入部门工作台" },
  { id: "ticket.view", group: "工单中心", label: "查看工单" },
  { id: "ticket.create", group: "工单中心", label: "新建工单" },
  { id: "ticket.accept", group: "工单中心", label: "接单处理" },
  { id: "ticket.reply", group: "工单中心", label: "跟进回复" },
  { id: "ticket.transfer", group: "工单中心", label: "跨部门转派" },
  { id: "ticket.escalate", group: "工单中心", label: "升级工单" },
  { id: "ticket.resolve", group: "工单中心", label: "标记已解决" },
  { id: "ticket.close", group: "工单中心", label: "关单归档" },
  { id: "approve.start", group: "审批中心", label: "发起审批" },
  { id: "approve.view", group: "审批中心", label: "查看审批" },
  { id: "approve.handle", group: "审批中心", label: "审批处理" },
  { id: "approve.revoke", group: "审批中心", label: "撤回审批" },
  { id: "purchase.view", group: "自动采购", label: "查看自动采购" },
  { id: "purchase.config", group: "自动采购", label: "配置采购规则" },
  { id: "purchase.run", group: "自动采购", label: "执行自动采购" },
  { id: "audit.view", group: "自动审核", label: "查看自动审核" },
  { id: "audit.config", group: "自动审核", label: "配置审核规则" },
  { id: "audit.run", group: "自动审核", label: "执行自动审核" },
  { id: "audit.sku", group: "自动审核", label: "执行 SKU 解绑" },
  { id: "seed.view", group: "内容种草", label: "查看内容种草" },
  { id: "seed.work", group: "内容种草", label: "内容种草作业" },
  { id: "seed.manage", group: "内容种草", label: "内容种草管理" },
  { id: "supply.view", group: "供应链", label: "查看供应链" },
  { id: "supply.work", group: "供应链", label: "供应链作业" },
  { id: "supply.manage", group: "供应链", label: "供应链管理" },
  { id: "biz.view", group: "工商", label: "查看工商合规" },
  { id: "biz.work", group: "工商", label: "工商作业" },
  { id: "biz.manage", group: "工商", label: "工商管理" },
  { id: "hr.view", group: "人事", label: "查看人事工作台" },
  { id: "hr.work", group: "人事", label: "人事作业" },
  { id: "hr.manage", group: "人事", label: "人事管理" },
  { id: "ops.home", group: "运营部站点", label: "进入首页工作台" },
  { id: "ops.data", group: "运营部站点", label: "进入数据中心" },
  { id: "ops.shen", group: "运营部站点", label: "进入沈子晗运营中心" },
  { id: "ops.han", group: "运营部站点", label: "进入韩梦凯运营中心" },
  { id: "ops.people", group: "运营部站点", label: "进入人员管理" },
  { id: "ops.releases", group: "运营部站点", label: "进入版本发布中心" },
  { id: "ops.profile", group: "运营部站点", label: "进入个人中心" }
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
