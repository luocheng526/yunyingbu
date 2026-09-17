import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/people/patch-app.js";
import { hydrateOrgStores, importStamp, mapImportRow, orgStoresPersistMode, resetOrgBoard } from "../src/modules/people/org-board.js";
import { resetOrgExtra } from "../src/modules/people/org-extra.js";
import { canEditRoster } from "../src/modules/people/org-acl.js";
import { hydrateFromMysql, resetPeopleStore } from "../src/modules/people/store.js";

const PRESET = [
  { name: "沈子晗", role: "经理", center: "沈子晗运营中心", status: "在职" },
  { name: "韩梦凯", role: "经理", center: "韩梦凯运营中心", status: "在职" },
  { name: "管理员", role: "经理", center: "人员管理", status: "在职" }
];

test.beforeEach(() => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
});

test("mapImportRow accepts Excel-style store headers", () => {
  assert.deepEqual(
    mapImportRow({ 店名: "A店", 所属人员: "张三", 商家ID: "188", 店铺编号: "SID188", 主账号: "demo_a" }),
    {
      storeName: "A店",
      owner: "张三",
      merchantId: "188",
      storeId: "SID188",
      login: "demo_a"
    }
  );
});

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test("GET /people is content-only and uses shared xm shell", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/people`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(text, /<title>组织中心<\/title>/);
    assert.match(text, /href="\/shared\/layout\.css"/);
    assert.match(text, /src="\/shared\/nav\.js"/);
    assert.match(text, /id="site-nav"/);
    assert.match(text, /href="\/people\.css"/);
    assert.match(text, /shared\/modules\/people\.js/);
    const noticesJs = await fetch(`${base}/shared/modules/notices.js`);
    const noticesText = await noticesJs.text();
    assert.equal(noticesJs.status, 200);
    assert.match(noticesText, /员工晋升报/);
    assert.match(noticesText, /龙虎榜/);
    assert.match(noticesText, /价值观践行/);
    assert.match(noticesText, /日常公告/);
    const css = await fetch(`${base}/people.css`);
    const cssText = await css.text();
    assert.match(cssText, /overflow-y:\s*auto\s*!important/);
    assert.match(cssText, /user-select:\s*text\s*!important/);
    assert.match(cssText, /\.org-search-form/);
    assert.match(cssText, /\.org-filter-pop\[hidden\]/);
    assert.match(cssText, /\.xm-main/);
    assert.doesNotMatch(text, /class="site-sidebar"/);
    assert.doesNotMatch(text, /<header class="site-header">/);
    assert.match(text, /组织中心/);

    const js = await fetch(`${base}/shared/modules/people.js`);
    const jsText = await js.text();
    assert.equal(js.status, 200);
    assert.match(jsText, /overflow-y:auto!important/);
    assert.match(jsText, /org-table-wrap\{overflow:visible!important/);
    assert.match(jsText, /max-height:none!important/);
    assert.match(jsText, /position:sticky/);
    assert.match(cssText, /org-table-wrap/);
    assert.match(cssText, /position:\s*sticky/);
    assert.doesNotMatch(cssText, /#xm-notice-mask\s*\{[\s\S]*?pointer-events: none !important/);
    assert.doesNotMatch(cssText, /\.people-page \.org-modal\.show\s*\{[\s\S]*?z-index: 90/);
    assert.match(cssText, /\.rights-mod-band \{/);
    assert.match(cssText, /border: 1px solid #ff4d4f/);
    assert.match(cssText, /\.rights-mod-lead \{/);
    assert.match(cssText, /min-height: 0/);
    assert.doesNotMatch(cssText, /\.rights-mod-lead\s*\{[^}]*background:/);
    assert.match(cssText, /\.rights-mod-col \{[\s\S]*?min-height: 26px/);
    assert.match(cssText, /\.rights-mod-manager\s*\{[\s\S]*?background: #fff2f0/);
    assert.match(cssText, /\.rights-mod-lead-seat:nth-child\(1\)\s*\{[\s\S]*?background: #fff7e6/);
    assert.match(cssText, /\.rights-mod-lead-seat:nth-child\(2\)\s*\{[\s\S]*?background: #fafafa/);
    assert.match(cssText, /\.rights-mod-row > \.rights-mod-col:nth-child\(1\)\s*\{[\s\S]*?background: #e6f4ff/);
    assert.match(cssText, /\.rights-mod-row > \.rights-mod-col:nth-child\(2\)\s*\{[\s\S]*?background: #fffdf5/);
    assert.match(cssText, /\.rights-mod-row > \.rights-mod-col:nth-child\(3\)\s*\{[\s\S]*?background: transparent/);
    assert.match(cssText, /\.rights-mod-manager\s*\{[\s\S]*?text-align: center/);
    assert.match(cssText, /\.rights-mod-lead\s*\{[\s\S]*?align-items: stretch/);
    assert.match(cssText, /\.rights-mod-col\s*\{[\s\S]*?justify-content: center/);
    assert.match(cssText, /\.rights-mod-card\s*\{[\s\S]*?justify-content: center/);
    assert.match(jsText, /onPeopleWheel/);
    assert.match(jsText, /店铺主数据/);
    assert.match(jsText, /总监/);
    assert.match(jsText, /主管\/储备/);
    assert.match(jsText, /org-filter-name">经理/);
    assert.match(jsText, /org-filter-name">运营/);
    assert.match(jsText, /org-filter-name">助理/);
    assert.match(jsText, /登录主账号/);
    assert.doesNotMatch(jsText, /id="org-team"/);
    assert.doesNotMatch(jsText, /id="org-status"/);
    assert.match(jsText, /org-filter-name/);
    assert.match(jsText, /双击单元格/);
    assert.match(jsText, /下载模板/);
    assert.match(jsText, /id="org-import"/);
    assert.match(jsText, /groupId: groupId/);
    assert.match(jsText, /decodeTableText/);
    assert.match(jsText, /gb18030/);
    assert.match(jsText, /normalizeStoreHeader/);
    assert.match(jsText, /另存为 CSV/);
    assert.match(jsText, /组织中心-店铺主数据模板/);
    assert.match(jsText, /org-check-all/);
    assert.match(jsText, /org-filter-btn/);
    assert.match(jsText, /data-filter-key="director"/);
    assert.match(jsText, /data-filter-key="supervisor"/);
    assert.match(jsText, /data-filter-key="reserve"/);
    assert.match(jsText, /blankStaffName/);
    assert.match(jsText, /data-filter-key="operator"/);
    assert.match(jsText, />全选/);
    assert.match(jsText, /keepTableTextSelectable/);
    assert.match(jsText, /user-select:text/);
    assert.match(jsText, /单元格可按住划选后复制/);
    assert.match(jsText, /applyStoreQuery/);
    assert.match(jsText, /bindLiveSearch/);
    assert.match(jsText, /id="people-kpis"/);
    assert.match(jsText, /renderPeopleKpis/);
    assert.match(jsText, /peopleLineKpiCounts/);
    assert.match(jsText, /uniqueLineKpiNames/);
    assert.doesNotMatch(jsText, /peopleRoleBucket/);
    assert.match(jsText, /__xmSearchStores/);
    assert.match(jsText, /__xmSearchPeople/);
    assert.doesNotMatch(jsText, /onSearchCapture/);
    assert.match(jsText, /compositionstart/);
    assert.match(jsText, /timer = window\.setTimeout/);
    assert.doesNotMatch(jsText, /oninput="window\.__xmSearch/);
    assert.doesNotMatch(jsText, /onkeyup="window\.__xmSearch/);
    assert.match(jsText, /org-search-form/);
    assert.match(jsText, /people-search-form/);
    assert.match(jsText, /type="text" id="org-q"/);
    assert.doesNotMatch(jsText, /keyCode === 229/);
    assert.match(jsText, /compositionend/);
    assert.match(jsText, /org-filter-count/);
    assert.match(jsText, /columnValueCounts/);
    assert.match(jsText, /filterDraft/);
    assert.match(jsText, /applyFilterDraft/);
    assert.match(jsText, /"家店铺"/);
    assert.match(jsText, /countsInStoreStats/);
    assert.doesNotMatch(jsText, /\["闲置中", summary.idle\]/);
    assert.match(jsText, /key === "remark"/);
    assert.match(jsText, /org-row-check/);
    assert.match(jsText, /店铺ID/);
    assert.match(jsText, /缺店铺ID/);
    assert.match(jsText, /缺密码/);
    assert.match(jsText, /缺运营/);
    assert.match(jsText, /运营中/);
    assert.match(jsText, /闲置中/);
    assert.match(jsText, /退店中/);
    assert.doesNotMatch(jsText, /5倍在做/);
    assert.match(jsText, /登录密码/);
    assert.match(jsText, /ChangeMe123!/);
    assert.match(jsText, /与姓名相同/);
    assert.doesNotMatch(jsText, /工号/);
    assert.doesNotMatch(jsText, /name="employeeNo"/);
    assert.match(jsText, /表头可筛总监、经理、主管、储备、运营、助理、状态/);
    assert.match(jsText, /导入按姓名合并/);
    assert.match(jsText, /并落盘，强制刷新还在/);
    assert.match(jsText, /people-cell/);
    assert.match(jsText, /startPersonCellEdit/);
    assert.match(jsText, /peopleLineCell\("director"/);
    assert.match(jsText, /peopleLineCell\("lineManager"/);
    assert.match(jsText, /peopleLineCell\("reserve"/);
    assert.match(jsText, /双击修改/);
    assert.match(jsText, /点别处保存/);
    assert.match(jsText, /pinCellBox/);
    assert.match(jsText, /bindImeSafeCommit/);
    assert.match(jsText, /onOutsidePointerDown/);
    assert.match(jsText, /document\.addEventListener\("pointerdown", onOutsidePointerDown, true\)/);
    assert.doesNotMatch(jsText, /min-width: 88px/);
    assert.match(jsText, /服务端未写入/);
    assert.match(jsText, /event.isComposing/);
    assert.match(jsText, /仅罗成、韩梦凯、沈子晗能改/);
    assert.match(jsText, /peopleData.canEdit === true/);
    assert.match(jsText, /people-row-check/);
    assert.match(jsText, /people-check-all/);
    assert.match(jsText, /people-bulk/);
    assert.match(jsText, /people-bulk-remove/);
    assert.match(jsText, /keepPeopleFormTyping/);
    assert.match(jsText, /nameInput\.focus\(\{ preventScroll: true \}\)/);
    assert.match(jsText, /\/api\/people\/passwords/);
    assert.match(jsText, /\/api\/people\/remove/);
    assert.doesNotMatch(jsText, /能看见的店/);
    assert.match(jsText, /data-filter-key="status"/);
    assert.match(jsText, /<th>账号<\/th><th>登录密码<\/th>/);
    assert.doesNotMatch(jsText, /店铺 \/ 店群/);
    assert.doesNotMatch(jsText, /id="shop-form"/);
    assert.doesNotMatch(jsText, /id="shop-tbody"/);
    assert.match(jsText, /id="people-filter-pop"/);
    assert.match(jsText, /data-filter-key="peopleManager"/);
    assert.match(jsText, /data-filter-key="peopleSupervisor"/);
    assert.match(jsText, /data-filter-key="peopleReserve"/);
    assert.match(jsText, /data-filter-key="peopleOperator"/);
    assert.match(jsText, /data-filter-key="status"/);
    assert.match(jsText, /applyMemberFilters/);
    assert.match(jsText, /导入按姓名合并/);
    assert.match(jsText, /一模一样的名字覆盖原行/);
    assert.match(jsText, /导入是合并不是换表/);
    assert.match(jsText, /同一家店才覆盖/);
    assert.match(jsText, /店铺导入会落盘/);
    assert.match(jsText, /normalizePeopleHeader/);
    assert.match(jsText, /endsWith\("姓名"\)/);
    assert.match(jsText, /people-import-file/);
    assert.match(jsText, /arrayBuffer/);
    assert.match(jsText, /这是店铺模板/);
    assert.match(jsText, /第" \+ item.line \+ "行" \+ item.error/);
    assert.match(jsText, /id="people-modal"/);
    assert.match(jsText, /id="people-add"/);
    assert.match(jsText, /10人\/页/);
    assert.match(jsText, /20人\/页/);
    assert.match(jsText, /50人\/页/);
    assert.match(jsText, /100人\/页/);
    assert.match(jsText, /id="people-pager"/);
    assert.match(jsText, /people-page-num/);
    assert.match(jsText, /data-page/);
    assert.match(jsText, /id="people-template"/);
    assert.match(jsText, /组织中心-身份名册模板/);
    assert.match(jsText, /\/api\/people\/import/);
    assert.match(jsText, /点新增人员弹出对话框/);
    assert.match(jsText, /id="people-q"/);
    assert.match(jsText, /id="people-search"/);
    assert.doesNotMatch(jsText, /id="rights-board"/);
    assert.doesNotMatch(jsText, /id="grant-form"/);
    assert.match(jsText, /id="rights-tree-chart"/);
    assert.match(jsText, /id="rights-refresh"/);
    assert.match(jsText, /总监/);
    assert.match(jsText, /fitRightsTree/);
    assert.match(jsText, /renderRightsManagerBand/);
    assert.match(jsText, /renderRightsLeadBox/);
    assert.match(jsText, /\(lead\.stores \|\| \[\]\)\.length \|\| looseAsst\.length/);
    assert.doesNotMatch(jsText, /looseAsst\.length && !ops\.length/);
    assert.match(jsText, /人员对不上/);
    assert.match(jsText, /店铺对不上/);
    assert.match(jsText, /主管\/储备/);
    assert.match(jsText, /rights-mod-band/);
    assert.match(jsText, /rights-mod-lead/);
    assert.match(jsText, /rights-mod-head/);
    assert.match(jsText, /renderRightsModHead/);
    assert.doesNotMatch(jsText, /rights-mod-director/);
    assert.doesNotMatch(jsText, /rights-mod-h">运营/);
    assert.match(jsText, /填写对应的店铺/);
    assert.match(jsText, /renderRightsModEmpty\("无"\)/);
    assert.match(jsText, /renderRightsTreeChart/);
    assert.match(jsText, /只读对照/);
    assert.match(jsText, /data-watch-open/);
    assert.match(jsText, /paintWatchIssues/);
    assert.match(jsText, /待补全要点数字才展开/);
    assert.match(jsText, /\/api\/people\/org\/rights-board/);
    assert.match(jsText, /placeFilterPop/);
    assert.match(jsText, /onFilterPin/);
    assert.match(jsText, /border-collapse:separate/);
    assert.doesNotMatch(jsText, /demo-flag/);
    assert.doesNotMatch(jsText, /演示<\/span>/);
    assert.doesNotMatch(jsText, /龙虎榜/);
    assert.doesNotMatch(jsText, /主数据治理/);
    assert.doesNotMatch(jsText, /全部公司/);
    assert.doesNotMatch(jsText, />缺口</);
  });
});

function uniqueLineKpiNames(people, key, seat) {
  const skip = new Set(["管理员", "无", "—", "点击填写"]);
  const leaders = new Set(["罗成", "韩梦凯", "沈子晗"]);
  const names = new Set();
  for (const person of people || []) {
    if (String(person.status || "") === "离职") {
      continue;
    }
    const raw = String(person[key] || "").trim();
    const self = String(person.name || "").trim();
    let name = raw;
    if (seat === "运营" && raw === "运营") {
      name = self;
    }
    if (seat === "助理" && raw === "助理") {
      name = self;
    }
    if (seat === "主管" && (raw === "主管" || raw === "主管/储备")) {
      name = self;
    }
    if (seat === "储备" && raw === "储备") {
      name = self;
    }
    if (!name || skip.has(name)) {
      continue;
    }
    if ((seat === "主管" || seat === "储备") && leaders.has(name)) {
      continue;
    }
    if (seat === "经理" && name === "罗成") {
      continue;
    }
    names.add(name);
  }
  return [...names];
}

function peopleLineKpiCounts(people) {
  const directors = uniqueLineKpiNames(people, "director", "总监");
  if (!directors.includes("罗成")) {
    directors.push("罗成");
  }
  return {
    总监: directors.length,
    经理: uniqueLineKpiNames(people, "lineManager", "经理").length,
    主管: uniqueLineKpiNames(people, "supervisor", "主管").length,
    储备: uniqueLineKpiNames(people, "reserve", "储备").length,
    运营: uniqueLineKpiNames(people, "operator", "运营").length,
    助理: uniqueLineKpiNames(people, "assistant", "助理").length
  };
}

test("member KPI cards count unique 在职 names in the five line columns", async () => {
  await withServer(async (base) => {
    const js = await fetch(`${base}/shared/modules/people.js`);
    const jsText = await js.text();
    assert.match(jsText, /uniqueLineKpiNames\(people, "supervisor"/);
    assert.match(jsText, /uniqueLineKpiNames\(people, "reserve"/);
    assert.match(jsText, /raw === "助理"/);
    assert.match(jsText, /LINE_KPI_LEADERS/);
    const res = await fetch(`${base}/api/people`);
    const data = await res.json();
    assert.deepEqual(peopleLineKpiCounts(data.people), {
      总监: 1,
      经理: 2,
      主管: 1,
      储备: 0,
      运营: 12,
      助理: 0
    });
    assert.deepEqual(
      peopleLineKpiCounts([
        { name: "杨润泽", status: "在职", director: "罗成", lineManager: "沈子晗", supervisor: "杨润泽", operator: "", assistant: "" },
        { name: "张文静", status: "在职", director: "罗成", lineManager: "沈子晗", supervisor: "张文静", operator: "张文静", assistant: "" },
        { name: "陈明婧", status: "在职", director: "罗成", lineManager: "沈子晗", supervisor: "张文静", operator: "陈明婧", assistant: "" },
        { name: "高传颖", status: "在职", director: "罗成", lineManager: "韩梦凯", supervisor: "高传颖", operator: "运营", assistant: "无" },
        { name: "李继双", status: "在职", director: "罗成", lineManager: "韩梦凯", supervisor: "陈晓曼", operator: "运营", assistant: "无" },
        { name: "张嘉庆", status: "在职", director: "罗成", lineManager: "韩梦凯", supervisor: "陈晓曼", operator: "无", assistant: "助理" },
        { name: "林晓彬", status: "在职", director: "罗成", lineManager: "韩梦凯", supervisor: "韩梦凯", operator: "运营", assistant: "无" },
        { name: "储备甲", status: "在职", director: "罗成", lineManager: "韩梦凯", supervisor: "", reserve: "储备甲", operator: "", assistant: "" },
        { name: "管理员", status: "在职", director: "罗成", lineManager: "管理员", supervisor: "张文静", operator: "张文静", assistant: "" }
      ]),
      {
        总监: 1,
        经理: 2,
        主管: 4,
        储备: 1,
        运营: 5,
        助理: 1
      }
    );
  });
});

test("GET /api/people returns Shen-line roster and grants", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.persist, "memory");
    assert.equal(data.demo, true);
    assert.equal(data.charter.agentAccess, "read-only");
    assert.ok(data.people.length >= 16);
    const wang = data.people.find((row) => row.name === "王博");
    assert.equal(wang.visibleShops.length, 2);
    assert.equal(wang.director, "罗成");
    assert.equal(wang.lineManager, "沈子晗");
    assert.equal(wang.operator, "王博");
    assert.equal(Object.prototype.hasOwnProperty.call(wang, "reserve"), true);
    assert.equal(wang.reserve, "");
    const cui = data.people.find((row) => row.name === "崔安琪");
    assert.equal(cui.supervisor, "杨润泽");
    assert.equal(cui.lineManager, "沈子晗");
    assert.equal(cui.operator, "崔安琪");
    const shops = await fetch(`${base}/api/people/shops`);
    const shopJson = await shops.json();
    assert.ok(shopJson.shops.some((row) => row.name === "RASW家居旗舰店"));
    const grants = await fetch(`${base}/api/people/grants`);
    const grantJson = await grants.json();
    assert.ok(grantJson.grants.length >= 18);
    for (const expected of PRESET) {
      const found = data.people.find((row) => row.name === expected.name);
      assert.deepEqual(
        {
          name: found.name,
          role: found.role,
          center: found.center,
          status: found.status,
          demo: found.demo
        },
        { ...expected, demo: true }
      );
    }
  });
});

test("GET /api/people/charter is read-only source rule", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people/charter`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.agentAccess, "read-only");
    assert.equal(data.sourceOfTruth.employment, "花名册");
    assert.match(data.sourceOfTruth.shopRights, /管辖/);
  });
});

test("org store board lists demo shops and supports add", async () => {
  await withServer(async (base) => {
    const summary = await fetch(`${base}/api/people/org/summary`);
    const summaryJson = await summary.json();
    assert.equal(summary.status, 200);
    assert.equal(typeof summaryJson.summary.missingPassword, "number");
    assert.equal(typeof summaryJson.summary.missingOwner, "number");
    assert.equal(typeof summaryJson.summary.missingStoreId, "number");
    assert.ok(summaryJson.summary.missingStoreId >= 15);
    assert.equal(summaryJson.summary.total, summaryJson.summary.operating);
    assert.equal(summaryJson.summary.idle, 0);
    assert.equal(summaryJson.summary.closing, 0);
    assert.equal(summaryJson.summary.closed, 0);

    const listed = await fetch(`${base}/api/people/org/stores`);
    const listedJson = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedJson.ok, true);
    assert.equal(listedJson.persist, "memory");
    assert.ok(listedJson.stores.length >= 15);
    assert.ok(listedJson.stores.some((row) => row.statusKey === "idle"));
    assert.ok(listedJson.stores.length > summaryJson.summary.total);
    assert.ok(listedJson.stores.some((row) => row.storeName === "RASW家居旗舰店"));
    const home = listedJson.stores.find((row) => row.storeName === "RASW家居旗舰店");
    assert.equal(home.director, "罗成");
    assert.equal(home.manager, "沈子晗");
    assert.equal(home.operator, "张文静");
    const yang = listedJson.stores.find((row) => row.storeName === "飒望家居日用旗舰店");
    assert.equal(yang.supervisor, "杨润泽");
    assert.equal(yang.operator, "崔安琪");
    assert.equal(yang.reserve, "");
    const clearedLead = await fetch(`${base}/api/people/org/stores/${yang.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisor: "", assistant: "" })
    });
    const clearedLeadJson = await clearedLead.json();
    assert.equal(clearedLead.status, 200, JSON.stringify(clearedLeadJson));
    assert.equal(clearedLeadJson.store.supervisor, "");
    assert.equal(clearedLeadJson.store.assistant, "");
    assert.equal(clearedLeadJson.store.updatedOn, importStamp());
    const afterClear = await (await fetch(`${base}/api/people/org/stores`)).json();
    const yangCleared = afterClear.stores.find((row) => row.id === yang.id);
    assert.equal(yangCleared.supervisor, "");
    assert.equal(yangCleared.operator, "崔安琪");
    assert.equal(yangCleared.updatedOn, importStamp());
    const searched = await fetch(`${base}/api/people/org/stores?q=${encodeURIComponent("RASW家居旗舰店")}`);
    const searchedJson = await searched.json();
    assert.equal(searched.status, 200);
    assert.ok(searchedJson.stores.length >= 1);
    assert.ok(searchedJson.stores.every((row) => String(row.storeName || "").includes("RASW家居旗舰店") || String(row.login || "").toLowerCase().includes("rasw")));

    const created = await fetch(`${base}/api/people/org/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chief: "沈子晗组",
        lead: "张文静",
        owner: "验收同事",
        storeName: "验收旗舰店",
        storeId: "SID199",
        merchantId: "19900001",
        remark: "运营中",
        login: "demo_ok",
        password: "Demo123!"
      })
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201, JSON.stringify(createdJson));
    assert.equal(createdJson.store.storeName, "验收旗舰店");
    assert.equal(createdJson.store.storeId, "SID199");

    const patched = await fetch(`${base}/api/people/org/stores/${createdJson.store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark: "已退店", closedOn: "9.9" })
    });
    const patchedJson = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedJson.store.statusKey, "closed");
    const closing = await fetch(`${base}/api/people/org/stores/${createdJson.store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark: "退店中" })
    });
    const closingJson = await closing.json();
    assert.equal(closing.status, 200);
    assert.equal(closingJson.store.statusKey, "closing");
    assert.equal(closingJson.store.remark, "退店中");

    const removed = await fetch(`${base}/api/people/org/stores/${createdJson.store.id}`, {
      method: "DELETE"
    });
    assert.equal(removed.status, 200);

    const template = await fetch(`${base}/api/people/org/stores/template`);
    const csv = await template.text();
    assert.equal(template.status, 200);
    assert.match(csv, /总监,经理,主管,储备,运营,助理,小组ID,店铺名称,店铺ID,商家id/);

    const imported = await fetch(`${base}/api/people/org/stores/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            总负责人: "沈子晗组",
            小组负责人: "张文静",
            店铺所属人员: "导入同事",
            店铺名称: "导入旗舰店",
            店铺ID: "SID188",
            商家ID: "18800001",
            店铺情况备注: "运营中",
            更新时间: "9.11更新",
            退店时间: "",
            登录主账号: "demo_imp",
            密码: "Demo123!"
          }
        ]
      })
    });
    const importedJson = await imported.json();
    assert.equal(imported.status, 200, JSON.stringify(importedJson));
    assert.equal(importedJson.created, 1);
    const listedAfter = await fetch(`${base}/api/people/org/stores?q=${encodeURIComponent("导入旗舰店")}`);
    const listedAfterJson = await listedAfter.json();
    assert.ok(
      listedAfterJson.stores.some(
        (row) =>
          row.storeName === "导入旗舰店" &&
          row.owner === "导入同事" &&
          row.operator === "导入同事" &&
          row.director === "罗成" &&
          row.manager === "沈子晗" &&
          row.storeId === "SID188"
      )
    );
    const byStoreId = await fetch(`${base}/api/people/org/stores?q=SID188`);
    const byStoreIdJson = await byStoreId.json();
    assert.ok(byStoreIdJson.stores.some((row) => row.storeId === "SID188"));
  });
});

test("store import upserts by groupId+shopId and does not touch other groups", async () => {
  await withServer(async (base) => {
    const before = await (await fetch(`${base}/api/people/org/stores`)).json();
    const hanCount = before.stores.filter((row) => row.chief.includes("韩梦凯")).length;
    const yangCount = before.stores.filter((row) => row.groupId === "杨润泽").length;
    const health = before.stores.find((row) => row.storeName === "RASW健康电器旗舰店");
    assert.equal(health.groupId, "郭桂良");
    assert.equal(health.updatedOn, "9.8更新");

    const first = await fetch(`${base}/api/people/org/stores/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            经理: "沈子晗",
            运营: "郭桂良",
            店铺名称: "RASW健康电器旗舰店",
            店铺ID: "218330674",
            商家id: "11001003",
            店铺情况备注: "运营中"
          }
        ]
      })
    });
    const firstJson = await first.json();
    assert.equal(first.status, 200, JSON.stringify(firstJson));
    assert.equal(firstJson.created, 0);
    assert.equal(firstJson.updated, 1);

    const after1 = await (await fetch(`${base}/api/people/org/stores?q=${encodeURIComponent("RASW健康电器旗舰店")}`)).json();
    const healthRows = after1.stores.filter((row) => row.storeName === "RASW健康电器旗舰店");
    assert.equal(healthRows.length, 1);
    assert.equal(healthRows[0].storeId, "218330674");
    assert.equal(healthRows[0].shopId, "218330674");
    assert.equal(healthRows[0].groupId, "郭桂良");
    assert.match(healthRows[0].updatedOn, /更新/);
    assert.notEqual(healthRows[0].updatedOn, "9.8更新");

    const yangSame = await fetch(`${base}/api/people/org/stores/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            经理: "沈子晗",
            "主管/储备": "杨润泽",
            运营: "崔安琪",
            店铺名称: "RASW健康电器旗舰店",
            店铺ID: "218330674",
            商家id: "99001003"
          }
        ]
      })
    });
    const yangJson = await yangSame.json();
    assert.equal(yangJson.created, 1, JSON.stringify(yangJson));

    const listed = await (await fetch(`${base}/api/people/org/stores`)).json();
    assert.equal(listed.stores.filter((row) => row.storeId === "218330674").length, 2);
    assert.equal(listed.stores.filter((row) => row.chief.includes("韩梦凯")).length, hanCount);

    const blocked = await fetch(`${base}/api/people/org/stores/import?actor=${encodeURIComponent("张文静")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            "主管/储备": "杨润泽",
            运营: "崔安琪",
            店铺名称: "飒望家居日用旗舰店",
            店铺ID: "should-not-write",
            商家id: "11001007"
          }
        ]
      })
    });
    const blockedJson = await blocked.json();
    assert.equal(blockedJson.created, 0, JSON.stringify(blockedJson));
    assert.equal(blockedJson.updated, 0);
    assert.ok(blockedJson.failed.length >= 1);

    const afterBlock = await (await fetch(`${base}/api/people/org/stores`)).json();
    const cui = afterBlock.stores.find((row) => row.storeName === "飒望家居日用旗舰店");
    assert.notEqual(cui.storeId, "should-not-write");
    assert.equal(afterBlock.stores.filter((row) => row.groupId === "杨润泽").length, yangCount + 1);

    const created = await fetch(`${base}/api/people/org/stores/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            经理: "沈子晗",
            运营: "郭桂良",
            店铺名称: "ABC新店",
            店铺ID: "999999"
          }
        ]
      })
    });
    const createdJson = await created.json();
    assert.equal(createdJson.created, 1, JSON.stringify(createdJson));
    assert.equal(createdJson.updated, 0);

    const afterCreate = await (await fetch(`${base}/api/people/org/stores`)).json();
    assert.equal(afterCreate.stores.length, listed.stores.length + 1);
    assert.ok(afterCreate.stores.some((row) => row.storeName === "RASW家居旗舰店"));

    const keepPassword = healthRows[0].password;
    const blankPatch = await fetch(`${base}/api/people/org/stores/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            经理: "沈子晗",
            运营: "郭桂良",
            店铺名称: "RASW健康电器旗舰店",
            店铺ID: "218330674",
            商家id: "11001003",
            密码: ""
          }
        ]
      })
    });
    const blankJson = await blankPatch.json();
    assert.equal(blankJson.updated, 1, JSON.stringify(blankJson));
    assert.equal(blankJson.created, 0);
    const afterBlank = await (await fetch(`${base}/api/people/org/stores?q=${encodeURIComponent("RASW健康电器旗舰店")}`)).json();
    const healthKept = afterBlank.stores.find((row) => row.groupId === "郭桂良");
    assert.equal(healthKept.password, keepPassword);
    assert.equal(afterBlank.stores.filter((row) => row.storeName === "RASW健康电器旗舰店").length, 2);
  });
});

test("rights board groups store staff under 总监经理主管运营", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people/org/rights-board`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data.roles, ["总监", "经理", "主管", "储备", "运营", "助理"]);
    const namesOf = (role) => (data.columns.find((col) => col.role === role).people || []).map((row) => row.name);
    assert.deepEqual(namesOf("总监"), ["罗成"]);
    assert.ok(namesOf("经理").includes("沈子晗"));
    assert.ok(namesOf("经理").includes("韩梦凯"));
    assert.ok(namesOf("主管").includes("杨润泽"));
    assert.ok(namesOf("运营").includes("张文静"));
    assert.ok(namesOf("运营").includes("陈晓曼"));
    assert.equal(namesOf("储备").length, 0);
    assert.equal(namesOf("助理").length, 0);
    assert.ok(!namesOf("运营").includes("管理员"));

    const pinned = await fetch(`${base}/api/people/org/rights-board/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "张文静", role: "储备" })
    });
    const pinnedJson = await pinned.json();
    assert.equal(pinned.status, 200, JSON.stringify(pinnedJson));
    assert.ok(pinnedJson.columns.find((col) => col.role === "储备").people.some((row) => row.name === "张文静"));
    assert.ok(!pinnedJson.columns.find((col) => col.role === "运营").people.some((row) => row.name === "张文静"));

    const unpinned = await fetch(`${base}/api/people/org/rights-board/unpin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "张文静" })
    });
    const unpinnedJson = await unpinned.json();
    assert.equal(unpinned.status, 200);
    assert.ok(unpinnedJson.columns.find((col) => col.role === "运营").people.some((row) => row.name === "张文静"));

    const tree = data.tree;
    assert.equal(tree.name, "罗成");
    assert.equal(tree.role, "总监");
    const managers = tree.children.map((row) => row.name);
    assert.ok(managers.includes("韩梦凯"));
    assert.ok(managers.includes("沈子晗"));
    const shen = tree.children.find((row) => row.name === "沈子晗");
    const yang = (shen.children || []).find((row) => row.name === "杨润泽");
    assert.ok(yang);
    assert.equal(yang.role, "主管");
    const cui = (yang.children || []).find((row) => row.name === "崔安琪");
    assert.ok(cui);
    assert.equal(cui.role, "运营");
    assert.ok((yang.stores || []).length + (yang.children || []).reduce((sum, child) => sum + (child.stores || []).length, 0) >= 1);
    assert.ok((shen.children || []).some((row) => row.name === "张文静" && row.role === "运营"));
    const han = tree.children.find((row) => row.name === "韩梦凯");
    const hanKids = han.children || [];
    assert.ok(hanKids.some((row) => row.name === "陈晓曼" && row.role === "运营"));
    assert.ok(hanKids.every((row) => row.role === "主管" || row.role === "储备" || row.role === "运营" || row.role === "助理"));
    const flattenStores = (node) =>
      (node.stores || [])
        .map((row) => row.storeName)
        .concat((node.children || []).flatMap(flattenStores));
    assert.ok(!flattenStores(tree).includes("SAWAA个护健康旗舰店"));
    const watch = data.watch;
    assert.equal(typeof watch.checkedAt, "string");
    assert.ok(watch.kpis.some((item) => item.label === "在营店铺" && item.value >= 15));
    assert.ok(watch.issues.some((item) => item.kind === "人员对不上" && item.title.includes("陈晓曼")));
    assert.ok(watch.issues.some((item) => item.kind === "待补全" && item.title.includes("缺店铺ID")));
    assert.equal(watch.conflict, true);
  });
});

test("rights tree follows assistant column when stored role still says 运营", async () => {
  await withServer(async (base) => {
    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "助理对照",
        role: "运营",
        center: "韩梦凯运营中心",
        lineManager: "韩梦凯",
        supervisor: "陈晓曼",
        operator: "无",
        assistant: "助理对照",
        status: "在职"
      })
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201, JSON.stringify(createdJson));

    const board = await fetch(`${base}/api/people/org/rights-board`);
    const boardJson = await board.json();
    const assistantColumn = boardJson.columns.find((column) => column.role === "助理");
    assert.ok(assistantColumn.people.some((person) => person.name === "助理对照"));
    assert.ok(boardJson.watch.kpis.some((item) => item.label === "助理对照" && item.value === "1/1"));
    assert.ok(boardJson.watch.kpis.some((item) => item.label === "人员对不上"));
    assert.ok(boardJson.watch.kpis.some((item) => item.label === "店铺对不上"));

    let found = null;
    function walk(node, path = []) {
      if (!node || found) {
        return;
      }
      if (node.name === "助理对照") {
        found = { node, path };
        return;
      }
      (node.children || []).forEach((child) => walk(child, path.concat(node.name)));
    }
    walk(boardJson.tree);
    assert.ok(found);
    assert.equal(found.node.role, "助理");
    assert.ok(!found.path.includes("无"));
  });
});

test("org board scopes edit by 责权", async () => {
  await withServer(async (base) => {
    const shen = await fetch(`${base}/api/people/org/stores?actor=${encodeURIComponent("沈子晗")}`);
    const shenJson = await shen.json();
    assert.equal(shenJson.scope, "shen");
    assert.ok(shenJson.stores.every((row) => row.chief.includes("沈子晗")));
    assert.ok(shenJson.stores.every((row) => row.canEdit));
    assert.ok(!shenJson.stores.some((row) => row.chief.includes("韩梦凯")));

    const hanStore = (await (await fetch(`${base}/api/people/org/stores`)).json()).stores.find((row) =>
      row.chief.includes("韩梦凯")
    );
    const denied = await fetch(`${base}/api/people/org/stores/${hanStore.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark: "已退店" })
    });
    assert.equal(denied.status, 403);

    const shenStore = shenJson.stores[0];
    const allowed = await fetch(`${base}/api/people/org/stores/${shenStore.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: "11001999" })
    });
    const allowedJson = await allowed.json();
    assert.equal(allowed.status, 200, JSON.stringify(allowedJson));
    assert.equal(allowedJson.store.merchantId, "11001999");

    const luo = await fetch(`${base}/api/people/org/stores/${hanStore.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "luo_ok" })
    });
    assert.equal(luo.status, 200);
  });
});

test("org extras list leaderboard values and notices", async () => {
  await withServer(async (base) => {
    const board = await fetch(`${base}/api/people/org/board`);
    const boardJson = await board.json();
    assert.equal(board.status, 200);
    assert.ok(boardJson.people.some((row) => row.name === "王博" && row.stores >= 2));
    assert.ok(boardJson.teams.some((row) => row.name.includes("沈子晗")));

    const values = await fetch(`${base}/api/people/org/values`);
    assert.ok((await values.json()).items.length >= 3);

    const created = await fetch(`${base}/api/people/org/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "验收公告", body: "组织中心页签验收" })
    });
    assert.equal(created.status, 201);
    const listed = await fetch(`${base}/api/people/org/notices`);
    const listedJson = await listed.json();
    assert.ok(listedJson.items.some((row) => row.title === "验收公告"));
  });
});

test("POST /api/people appends a staff row", async () => {
  await withServer(async (base) => {
    const body = {
      name: "测试同事",
      role: "运营",
      center: "数据中心",
      status: "在职"
    };
    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdJson.ok, true);
    assert.equal(createdJson.person.demo, false);
    assert.equal(createdJson.person.name, body.name);
    assert.equal(createdJson.person.username, body.name);
    assert.equal(createdJson.person.password, "ChangeMe123!");

    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    assert.equal(listedJson.people.length, 17);
    assert.ok(listedJson.people.some((row) => row.name === "测试同事" && row.center === "数据中心"));
    const shen = listedJson.people.find((row) => row.name === "沈子晗");
    assert.equal(shen.username, "沈子晗");
    assert.equal(shen.password, "ChangeMe123!");
  });
});

test("PATCH /api/people updates username and password", async () => {
  await withServer(async (base) => {
    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    const wang = listedJson.people.find((row) => row.name === "王博");
    const patched = await fetch(`${base}/api/people/${wang.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wangbo", password: "ShopLogin1" })
    });
    const patchedJson = await patched.json();
    assert.equal(patched.status, 200, JSON.stringify(patchedJson));
    assert.equal(patchedJson.person.username, "wangbo");
    assert.equal(patchedJson.person.password, "ShopLogin1");

    const empty = await fetch(`${base}/api/people/${wang.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "   " })
    });
    assert.equal(empty.status, 400);

    const taken = await fetch(`${base}/api/people/${wang.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "沈子晗" })
    });
    assert.equal(taken.status, 400);

    const overlay = JSON.parse(fs.readFileSync("src/modules/people/data/people-logins.json", "utf8"));
    assert.equal(overlay[String(wang.id)].username, "wangbo");
    assert.equal(overlay[String(wang.id)].password, "ShopLogin1");
  });
});

test("PATCH /api/people/passwords sets one password for selected staff", async () => {
  await withServer(async (base) => {
    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    const wang = listedJson.people.find((row) => row.name === "王博");
    const yang = listedJson.people.find((row) => row.name === "杨润泽");
    const empty = await fetch(`${base}/api/people/passwords`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [wang.id], password: "  " })
    });
    assert.equal(empty.status, 400);
    const none = await fetch(`${base}/api/people/passwords`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [], password: "TeamPass1" })
    });
    assert.equal(none.status, 400);
    const patched = await fetch(`${base}/api/people/passwords`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [wang.id, yang.id], password: "TeamPass1" })
    });
    const patchedJson = await patched.json();
    assert.equal(patched.status, 200, JSON.stringify(patchedJson));
    assert.equal(patchedJson.updated, 2);
    const after = await fetch(`${base}/api/people`);
    const afterJson = await after.json();
    assert.equal(afterJson.people.find((row) => row.id === wang.id).password, "TeamPass1");
    assert.equal(afterJson.people.find((row) => row.id === yang.id).password, "TeamPass1");
    assert.equal(afterJson.people.find((row) => row.name === "沈子晗").password, "ChangeMe123!");
  });
});

test("POST /api/people/remove deletes selected staff and their grants", async () => {
  await withServer(async (base) => {
    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    const wang = listedJson.people.find((row) => row.name === "王博");
    const admin = listedJson.people.find((row) => row.name === "管理员");
    const empty = await fetch(`${base}/api/people/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] })
    });
    assert.equal(empty.status, 400);
    const blocked = await fetch(`${base}/api/people/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [admin.id] })
    });
    assert.equal(blocked.status, 400);
    const removed = await fetch(`${base}/api/people/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [wang.id] })
    });
    const removedJson = await removed.json();
    assert.equal(removed.status, 200, JSON.stringify(removedJson));
    assert.equal(removedJson.removed, 1);
    const after = await fetch(`${base}/api/people`);
    const afterJson = await after.json();
    assert.equal(afterJson.people.some((row) => row.name === "王博"), false);
    const grants = await fetch(`${base}/api/people/grants`);
    const grantsJson = await grants.json();
    assert.equal(grantsJson.grants.some((row) => row.personName === "王博"), false);
  });
});

test("people roster template and import merges by exact name", async () => {
  await withServer(async (base) => {
    const template = await fetch(`${base}/api/people/template`);
    const csv = await template.text();
    assert.equal(template.status, 200);
    assert.match(csv, /姓名,总监,经理,主管,储备,运营,助理,状态,账号,登录密码/);

    const before = await (await fetch(`${base}/api/people`)).json();
    const seedCount = before.people.length;
    const wang = before.people.find((row) => row.name === "王博");

    const imported = await fetch(`${base}/api/people/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            姓名: "导入同事",
            部门: "数据中心",
            上级: "管理员",
            岗位: "运营",
            所属中心: "数据中心",
            状态: "在职",
            账号: "daoru",
            登录密码: "Import1!"
          },
          {
            姓名: "模板同事",
            总监: "罗成",
            经理: "沈子晗",
            "主管/储备": "",
            运营: "模板同事",
            助理: "",
            状态: "在职",
            账号: "moban",
            登录密码: "Import2!"
          }
        ]
      })
    });
    const importedJson = await imported.json();
    assert.equal(imported.status, 200, JSON.stringify(importedJson));
    assert.equal(importedJson.created, 2, JSON.stringify(importedJson));
    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    const row = listedJson.people.find((item) => item.username === "daoru");
    assert.equal(row.name, "导入同事");
    assert.equal(row.password, "Import1!");
    const templated = listedJson.people.find((item) => item.username === "moban");
    assert.equal(templated.lineManager, "沈子晗");
    assert.equal(templated.operator, "模板同事");
    assert.equal(listedJson.people.length, seedCount + 2);
    assert.ok(listedJson.people.some((item) => item.name === "王博"));

    const overwrite = await fetch(`${base}/api/people/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            姓名: "王博",
            总监: "罗成",
            经理: "沈子晗",
            运营: "王博",
            状态: "在职",
            账号: "wangbo-import",
            登录密码: "Overwrite1!"
          }
        ]
      })
    });
    const overwriteJson = await overwrite.json();
    assert.equal(overwrite.status, 200, JSON.stringify(overwriteJson));
    assert.equal(overwriteJson.created, 0);
    assert.equal(overwriteJson.updated, 1);
    const afterOverwrite = await (await fetch(`${base}/api/people`)).json();
    assert.equal(afterOverwrite.people.length, seedCount + 2);
    const wangAfter = afterOverwrite.people.find((item) => item.id === wang.id);
    assert.equal(wangAfter.name, "王博");
    assert.equal(wangAfter.username, "wangbo-import");
    assert.equal(wangAfter.password, "Overwrite1!");

    const fresh = await fetch(`${base}/api/people/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            姓名: "全新同事",
            总监: "罗成",
            经理: "韩梦凯",
            运营: "全新同事",
            状态: "在职",
            账号: "quanxin",
            登录密码: "NewStaff1!"
          }
        ]
      })
    });
    const freshJson = await fresh.json();
    assert.equal(freshJson.created, 1);
    assert.equal(freshJson.updated, 0);
    const afterFresh = await (await fetch(`${base}/api/people`)).json();
    assert.equal(afterFresh.people.length, seedCount + 3);
    assert.ok(afterFresh.people.some((item) => item.name === "导入同事"));
    assert.ok(afterFresh.people.some((item) => item.name === "王博"));
  });
});

test("roster line cells are editable only by 罗成, 韩梦凯, 沈子晗", async () => {
  assert.equal(canEditRoster("罗成"), true);
  assert.equal(canEditRoster("韩梦凯"), true);
  assert.equal(canEditRoster("沈子晗"), true);
  assert.equal(canEditRoster("张文静"), false);
  assert.equal(canEditRoster("管理员"), false);

  await withServer(async (base) => {
    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    assert.equal(listedJson.canEdit, true);
    const wang = listedJson.people.find((row) => row.name === "王博");
    assert.ok(wang);

    const deniedList = await fetch(`${base}/api/people?actor=${encodeURIComponent("张文静")}`);
    const deniedListJson = await deniedList.json();
    assert.equal(deniedListJson.canEdit, false);

    const denied = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("张文静")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisor: "杨润泽" })
    });
    assert.equal(denied.status, 403);

    const byShen = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisor: "杨润泽" })
    });
    const byShenJson = await byShen.json();
    assert.equal(byShen.status, 200, JSON.stringify(byShenJson));
    assert.equal(byShenJson.person.supervisor, "杨润泽");

    const byHan = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("韩梦凯")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineManager: "韩梦凯" })
    });
    const byHanJson = await byHan.json();
    assert.equal(byHan.status, 200, JSON.stringify(byHanJson));
    assert.equal(byHanJson.person.lineManager, "韩梦凯");

    const byLuo = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistant: "小助" })
    });
    const byLuoJson = await byLuo.json();
    assert.equal(byLuo.status, 200, JSON.stringify(byLuoJson));
    assert.equal(byLuoJson.person.assistant, "小助");

    const namePatch = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "王博改" })
    });
    const nameJson = await namePatch.json();
    assert.equal(namePatch.status, 200, JSON.stringify(nameJson));
    assert.equal(nameJson.person.name, "王博改");
    await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "王博" })
    });

    const reservePatch = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserve: "张文静" })
    });
    const reserveJson = await reservePatch.json();
    assert.equal(reservePatch.status, 200, JSON.stringify(reserveJson));
    assert.equal(reserveJson.person.reserve, "张文静");
    const afterReserve = await (await fetch(`${base}/api/people`)).json();
    const wangReserve = afterReserve.people.find((row) => row.id === wang.id);
    assert.equal(wangReserve.reserve, "张文静");
    const reserveAgain = await fetch(`${base}/api/people/${wang.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserve: "杨润泽" })
    });
    const reserveAgainJson = await reserveAgain.json();
    assert.equal(reserveAgain.status, 200, JSON.stringify(reserveAgainJson));
    assert.equal(reserveAgainJson.person.reserve, "杨润泽");

    const blockedCreate = await fetch(`${base}/api/people?actor=${encodeURIComponent("张文静")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "路人", role: "运营", center: "数据中心", status: "在职" })
    });
    assert.equal(blockedCreate.status, 403);
  });
});

test("POST /api/people rejects missing name", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "运营", center: "数据中心" })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.ok, false);
  });
});

test("people import creates rows even if 总监 is 罗成 and 经理 is missing", async () => {
  await withServer(async (base) => {
    const before = await (await fetch(`${base}/api/people`)).json();
    const imported = await fetch(`${base}/api/people/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            姓名: "新同事甲",
            总监: "罗成",
            经理: "",
            运营: "新同事甲",
            状态: "在职",
            账号: "xinjiashang-a"
          },
          {
            姓名: "新同事乙",
            总监: "罗成",
            经理: "精铺组 韩梦凯",
            运营: "新同事乙",
            状态: "在职"
          },
          {
            姓名: "新同事丙",
            总监: "罗成",
            经理: "不存在的经理",
            所属中心: "韩梦凯组",
            运营: "新同事丙",
            状态: "在职"
          }
        ]
      })
    });
    const importedJson = await imported.json();
    assert.equal(imported.status, 200, JSON.stringify(importedJson));
    assert.equal(importedJson.failed.length, 0, JSON.stringify(importedJson));
    assert.equal(importedJson.created, 3, JSON.stringify(importedJson));
    const after = await (await fetch(`${base}/api/people`)).json();
    assert.equal(after.people.length, before.people.length + 3);
    const yi = after.people.find((row) => row.name === "新同事乙");
    assert.equal(yi.lineManager, "精铺组 韩梦凯");
    assert.ok(after.people.some((row) => row.name === "沈子晗"));
  });
});

test("people store exports hydrateFromMysql for notes-store boot", async () => {
  assert.equal(typeof hydrateFromMysql, "function");
  const result = await hydrateFromMysql();
  assert.equal(result.ok, true);
  assert.equal(result.mode, "memory");
  const org = await hydrateOrgStores();
  assert.equal(org.ok, true);
  assert.equal(orgStoresPersistMode(), "memory");
});

test("patchAppSource only inserts people router mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ peopleRouter \} from "\.\/modules\/people\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/people", peopleRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
