const { test } = require('node:test');
const assert = require('node:assert/strict');
const { centeredBounds, allowedUrl, desktopOrigin, backgroundFor } = require('../window-policy.cjs');

test('window stays centered inside small, scaled, and secondary-display work areas', () => {
  for (const area of [{x:0,y:0,width:1920,height:1040},{x:0,y:0,width:1280,height:680},{x:-1920,y:120,width:1920,height:1080},{x:2560,y:0,width:1536,height:824}]) {
    const b=centeredBounds(area);
    assert.ok(b.width<=1380 && b.height<=880);
    assert.ok(b.x>=area.x && b.y>=area.y);
    assert.ok(b.x+b.width<=area.x+area.width && b.y+b.height<=area.y+area.height);
    assert.ok(Math.abs((b.x-area.x)*2+b.width-area.width)<=1);
    assert.ok(Math.abs((b.y-area.y)*2+b.height-area.height)<=1);
  }
});
test('native renderer privileges are restricted to the exact company origin', () => {
  assert.equal(allowedUrl('https://zx.xingmaierp.cc/home?app=glass'),true);
  for(const url of ['https://zx.xingmaierp.cc.evil.example','https://evil.example/?https://zx.xingmaierp.cc','http://zx.xingmaierp.cc','file:///C:/Windows','javascript:alert(1)','https://name:password@zx.xingmaierp.cc']) assert.equal(allowedUrl(url),false,url);
});
test('production always ignores development URL overrides', () => {
  assert.equal(desktopOrigin(true,'http://127.0.0.1:4187'),'https://zx.xingmaierp.cc');
  assert.equal(desktopOrigin(false,'http://127.0.0.1:4187/home'),'http://127.0.0.1:4187');
  assert.throws(()=>desktopOrigin(false,'https://example.com'));
});
test('uses live acrylic or macOS vibrancy only on supported systems', () => {
  assert.equal(backgroundFor('win32','10.0.26300'),'acrylic');
  assert.equal(backgroundFor('win32','10.0.22000'),'solid');
  assert.equal(backgroundFor('darwin','25.0.0'),'vibrancy');
});
