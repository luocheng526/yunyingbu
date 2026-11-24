import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/shared/modules/work-center.js', import.meta.url), 'utf8');

test('工作设置显示组织中心直属上级和工作中心所属团队', async () => {
  const assistant = {
    id: '55',
    name: '测试助理',
    orgRole: '助理',
    role: '运营助理',
    managerId: '4',
    managerName: '',
    parentName: '测试带教',
    parentId: '1',
    teamId: 'manager-1',
    teamName: '测试经理直属团队',
  };
  const legacyMember = {
    id: '8',
    name: '旧名册员工',
    orgRole: '员工',
    role: '员工',
    managerName: '',
    parentId: '1',
    teamId: 'manager-1',
    teamName: '测试经理直属团队',
  };
  const people = [assistant, legacyMember];
  const data = {
    canManage: true,
    tabs: [{ id: 'work.settings', name: '工作设置', tab: 'settings' }],
    permissions: { 'work.settings': { enter: true, edit: true } },
    me: { name: '测试总监', role: '总监' },
    from: '2026-11-24',
    to: '2026-11-24',
    notices: [],
    alerts: [],
    people,
    options: { people, roles: [], boards: [], shops: [], departments: [] },
    settings: { weekdays: [], restDays: [], categories: [], requiredAttachmentCategories: [] }
  };
  const window = {};
  const root = { innerHTML: '', addEventListener() {}, querySelectorAll: () => [] };
  runInNewContext(source, {
    window,
    AbortController,
    FormData,
    URLSearchParams,
    location: { search: '' },
    fetch: async () => ({ ok: true, json: async () => data })
  });

  const unmount = window.XmWorkCenter.mount(root);
  await setImmediate();
  assert.match(root.innerHTML, /<th>直属上级<\/th><th>所属团队<\/th>/);
  assert.match(root.innerHTML, /<td>测试助理<\/td><td>助理<\/td><td>运营助理<\/td><td>测试带教<\/td><td>测试经理直属团队<\/td><\/tr>/);
  assert.match(root.innerHTML, /<td>旧名册员工<\/td><td>员工<\/td><td>员工<\/td><td>—<\/td><td>测试经理直属团队<\/td><\/tr>/);
  assert.doesNotMatch(root.innerHTML, /调整关联|personSettings/);
  unmount();
});
