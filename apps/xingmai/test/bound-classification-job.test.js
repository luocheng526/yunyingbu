import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { collectClassifications } from "../src/modules/bound/collect-classifications.js";
import { SHOP_DAY } from "../src/modules/bound/shop-day-contract.js";

test("分类补采先排除活动采集，失败即停并保留此前完成的分类", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-classification-"));
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
  await mkdir(dir, { recursive: true });
  let active = true;
  let membership = 'valid';
  const sent = [];
  const reply = body => ({ ok: true, json: async () => body });
  const fetcher = async (url, options) => {
    if (url.endsWith('/api/bound/shop-day')) return reply({ ok: true, scope: SHOP_DAY, inventory: { complete: true, items: [{ goodsId: 'one', spuid: 'spu-one' }] }, run: { status: active ? 'collecting' : 'complete_with_deferred' } });
    if (url.includes('/report?')) return reply({ record: { reportId: 'shop_cards_sku', scope: SHOP_DAY, status: 'received', rows: [{ id: 1, count: membership === 'duplicate' ? '2' : '1', cardName: '第一类' }, { id: 2, count: '1', cardName: '第二类' }] } });
    const input = JSON.parse(options.body); sent.push(input);
    if (input.cardId === '2') return reply({ ok: false, reason: 'server_login_required' });
    const rows = membership === 'duplicate' ? [{ goodsId: 'one' }, { goodsId: 'one' }] : [{ goodsId: membership === 'foreign' ? 'other-shop-product' : 'one' }];
    return reply({ ok: true, record: { ...input, total: rows.length, rows: input.reportId.endsWith('page') ? rows : [{ sumLine: true }], requestCount: 1, requestHash: 'sum-hash' } });
  };
  try {
    await assert.rejects(collectClassifications({ base: 'http://127.0.0.1:52483', directory, fetcher }), /先等待/);
    assert.equal(sent.length, 0);
    active = false;
    const result = await collectClassifications({ base: 'http://127.0.0.1:52483', directory, fetcher });
    assert.equal(result.status, 'stopped');
    assert.equal(result.done, 1);
    assert.equal(result.errors[0].reason, 'server_login_required');
    assert.equal(sent.length, 3);
    const saved = JSON.parse(await readFile(join(dir, 'classification-run.json'), 'utf8'));
    assert.equal(saved.cards[0].cardId, '1');
    assert.deepEqual(saved.cards[0].identities, ['one']);
    assert.equal(saved.status, 'stopped');
    for (membership of ['foreign', 'duplicate']) {
      sent.length = 0;
      const rejected = await collectClassifications({ base: 'http://127.0.0.1:52483', directory, fetcher });
      assert.equal(rejected.done, 0);
      assert.equal(rejected.errors[0].reason, 'card_membership_unverified');
      assert.equal(sent.length, 1);
    }
  } finally {
    assert.equal(dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
});
