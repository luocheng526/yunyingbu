const { test } = require('node:test');
const assert = require('node:assert/strict');
const shortcuts = require('../renderer/shortcut-model.js');
const defaults = ['/home', '/work', '/me'];

test('a shortcut can be added, moved without duplication, removed and restored after restart', () => {
  let saved = shortcuts.read(null, defaults);
  saved = shortcuts.move(saved, '/people', '/work');
  assert.deepEqual(saved, ['/home', '/people', '/work', '/me']);
  saved = shortcuts.move(saved, '/people', '/home');
  assert.deepEqual(saved, ['/people', '/home', '/work', '/me']);
  saved = shortcuts.remove(saved, '/people');
  assert.deepEqual(shortcuts.read(JSON.stringify(saved), defaults), defaults);
  assert.deepEqual(shortcuts.move(saved, '/work', '/work'), saved);
});
test('removing every shortcut stays empty after restart, rather than restoring defaults', () => {
  const empty = defaults.reduce((list, href) => shortcuts.remove(list, href), defaults);
  assert.deepEqual(shortcuts.read(JSON.stringify(empty), defaults), []);
});
test('preferences belong to the signed-in account and inaccessible routes do not render', () => {
  assert.notEqual(shortcuts.key('employee-a'), shortcuts.key('employee-b'));
  assert.equal(shortcuts.key('用户'), null);
  assert.deepEqual(shortcuts.visible(['/home','/people','/work'], new Set(['/home','/work'])), ['/home','/work']);
});
test('malformed storage and external or script URLs cannot become navigation shortcuts', () => {
  assert.deepEqual(shortcuts.read('{broken', defaults), defaults);
  assert.deepEqual(shortcuts.read(JSON.stringify(['/home','https://example.com','javascript:alert(1)','//example.com','/work','/home']), defaults), ['/home','/work']);
});
