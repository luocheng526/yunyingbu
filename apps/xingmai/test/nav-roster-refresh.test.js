import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/shared/nav.js', import.meta.url), 'utf8');
function navigation() {
  const state = {
    reloads: 0, invalidations: 0,
    window: { location: { reload() { state.reloads++; } } },
    personLooksHr: () => false, canSeeStaffNav: () => true,
    rememberStaffUser(user) { state.user = user; }, paintWatermark() {},
    invalidateCenterScope() { state.invalidations++; },
    orgFlagsFromUser: () => ({}), orgFlags: null,
    paintSider() {}, relinkSider() {}, ensureOpenTabs() {}, paintTabs() {},
    isHrDesk: () => false
  };
  vm.createContext(state);
  vm.runInContext(
    source.slice(source.indexOf('  let scopeKey ='), source.indexOf('  function paintSider()')) +
    source.slice(source.indexOf('  function applyScopeUser('), source.indexOf('  function readScopeMe()')),
    state
  );
  return state;
}
function user() {
  return { username: 'test-admin', visibleShops: ['shop-1'], siteAcl: {
    configured: true, revision: 'before', paths: { '/people': { see: true, enter: true, edit: true } },
    modules: { people: { see: true, enter: true, edit: true, features: { 'people.members': { see: true, enter: true, edit: true } } } },
    stores: { 'shop-1': { see: true, enter: true, edit: true } }
  } };
}

test('roster changes invalidate cached organization data without reloading the page', () => {
  const nav = navigation(), actor = user();
  nav.applyScopeUser(actor);
  actor.siteAcl.revision = 'after-member-save';
  nav.applyScopeUser(actor);
  assert.equal(nav.reloads, 0);
  assert.equal(nav.invalidations, 2);
  assert.equal(nav.user.siteAcl.revision, 'after-member-save');
  nav.applyScopeUser(actor);
  assert.equal(nav.invalidations, 2);
  assert.equal(actor.siteAcl.revision, 'after-member-save');
});

test('actual module and member permission revocations still clear stale mounted pages', () => {
  for (const revoke of [
    actor => { actor.siteAcl.paths['/people'].enter = false; },
    actor => { actor.siteAcl.modules.people.features['people.members'].edit = false; }
  ]) {
    const nav = navigation(), actor = user();
    nav.applyScopeUser(actor); revoke(actor); nav.applyScopeUser(actor);
    assert.equal(nav.reloads, 1);
  }
});

test('own team and shop-scope changes still reload stale data', () => {
  for (const update of [
    actor => { actor.supervisor = 'new-supervisor'; },
    actor => { actor.visibleShops = ['shop-2']; },
    actor => { actor.siteAcl.stores['shop-1'].enter = false; }
  ]) {
    const nav = navigation(), actor = user();
    nav.applyScopeUser(actor); update(actor); nav.applyScopeUser(actor);
    assert.equal(nav.reloads, 1);
  }
});

test('users without configured site permissions keep the existing no-change behavior', () => {
  const nav = navigation(), actor = { username: 'legacy-user' };
  nav.applyScopeUser(actor); nav.applyScopeUser(actor);
  assert.equal(nav.reloads, 0);
  assert.equal(nav.invalidations, 1);
});
