// Shared catalog for the organization editor, shell tabs and work API.
export const WORK_FEATURES = [
  { id: 'work.overview', name: '工作总览', tab: 'overview', legacy: ['work.today'] },
  { id: 'work.people', name: '人员明细', tab: 'people', legacy: ['work.duty'] },
  { id: 'work.tasks', name: '任务管理', tab: 'tasks', legacy: ['work.today'] },
  { id: 'work.reports', name: '工作汇报', tab: 'reports', legacy: ['work.today'] },
  { id: 'work.management', name: '管理看板', tab: 'supervisors', legacy: ['work.summary'] },
  { id: 'work.acceptance', name: '任务验收', tab: 'acceptance', legacy: ['work.duty'], legacyEdit: 'work.today' },
  { id: 'work.statistics', name: '工作统计', tab: 'statistics', legacy: ['work.summary'] },
  { id: 'work.settings', name: '工作设置', tab: 'settings' },
  { id: 'work.execute', name: '执行任务（开始、进度、提交）', legacy: ['work.today'] },
  { id: 'work.publish', name: '发布与管理任务（编辑、拆分、取消）', legacy: ['work.today'] },
  { id: 'work.records', name: '登记工作与问题', legacy: ['work.today'] },
  { id: 'work.export', name: '导出工作统计', legacy: ['work.summary'] },
  { id: 'work.messages', name: '工作消息', legacy: ['work.today'] },
  { id: 'work.legacySettings', name: '部门模板设置', legacy: ['work.settings'] },
  { id: 'work.legacyDiary', name: '店铺日报设置', legacy: ['work.diary'] }
];

// Migration is read-only until the administrator saves. The version is retained
// even for empty grants, so an explicitly revoked feature cannot reappear.
export const migrateWorkCap = cap => migrateFeatureCap(cap, WORK_FEATURES);
export function migrateFeatureCap(cap, catalog) {
  if (!cap || cap.catalogVersion >= 2) return cap;
  const features = { ...cap.features };
  for (const feature of catalog) {
    if (Object.hasOwn(features, feature.id)) continue;
    const old = (feature.legacy || []).map(id => cap.features?.[id]).filter(Boolean);
    features[feature.id] = Object.fromEntries(['see', 'enter', 'edit'].map(right => [right, (feature.legacyAll ? old.length === feature.legacy.length && old.every(value => value[right]) : old.some(value => value[right])) && (right !== 'edit' || !feature.legacyEdit || Boolean(cap.features?.[feature.legacyEdit]?.edit))]));
  }
  return { ...cap, catalogVersion: 2, features };
}

export function workTaskActionFeature(action) {
  if (['start', 'progress', 'submit'].includes(action)) return 'execute';
  if (['approve', 'return', 'review'].includes(action)) return 'acceptance';
  if (action === 'confirmTeam') return 'settings';
  return 'publish';
}

export function workRequestFeature(tail, query = {}) {
  // Bootstrap and mutation bodies are checked by the work domain after parsing.
  if (/^center\/?$/.test(tail) || tail === 'tasks/action') return '';
  if (tail === 'tasks/context') return ['work.publish', 'work.tasks', 'work.acceptance'];
  if (tail === 'tasks/file' || /^center\/tasks\//.test(tail)) return ['work.tasks', 'work.acceptance', 'work.reports', 'work.overview', 'work.people', 'work.management', 'work.statistics', 'work.export'];
  if (/^center\/image\//.test(tail)) return ['work.tasks', 'work.acceptance', 'work.reports', 'work.records', 'work.overview', 'work.people', 'work.management', 'work.statistics', 'work.settings'];
  if (/^center\/notices/.test(tail)) return 'work.messages';
  if (/^center\/export/.test(tail)) return 'work.export';
  if (/^center\/(settings|reminders)/.test(tail)) return 'work.settings';
  if (/^center\/(work|issue)/.test(tail)) return 'work.records';
  if (/^tasks\/publish/.test(tail)) return 'work.publish';
  if (/^tasks/.test(tail)) return query.queue === 'review' ? 'work.acceptance' : 'work.tasks';
  if (/^diary\/(settings|ding|rest)/.test(tail)) return 'work.legacyDiary';
  if (/^settings/.test(tail)) return 'work.legacySettings';
  if (/summary|export/.test(tail)) return 'work.statistics';
  if (/duty/.test(tail)) return 'work.people';
  if (/badges/.test(tail)) return '';
  return 'work.reports';
}
