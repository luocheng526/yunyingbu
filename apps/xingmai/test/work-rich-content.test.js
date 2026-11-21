import test from "node:test";
import assert from "node:assert/strict";
import { parseRichContent, bindRichFiles, richPlainText } from "../src/modules/work/rich-content.js";
import { publishTask, listTasks, readTaskFile, resetTaskStore, setTaskNotifier } from "../src/modules/work/tasks.js";
import { resetPeopleStore } from "../src/modules/people/store.js";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=", "base64");
const files = [{ name: "inline.png", mime: "image/png", bytes: png }];

test("structured text preserves text/image/text order and binds only uploaded images", () => {
  const nodes = parseRichContent(JSON.stringify([{type:"text",text:"第一步\n"},{type:"image",upload:0},{type:"text",text:"\n第二步"}]), files, 4000);
  assert.deepEqual(bindRichFiles(nodes,[{id:"owned-file-id"}]),[{type:"text",text:"第一步\n"},{type:"image",fileId:"owned-file-id"},{type:"text",text:"\n第二步"}]);
  assert.equal(richPlainText(nodes,""),"第一步\n\n第二步");
});

test("legacy text remains compatible, rich text is never silently truncated", () => {
  assert.equal(parseRichContent(undefined,files,4000),null);
  assert.equal(richPlainText(null,"旧任务说明"),"旧任务说明");
  assert.throws(()=>parseRichContent(JSON.stringify([{type:"text",text:"字".repeat(4001)}]),files,4000),/最多 4000/);
  assert.equal(parseRichContent(JSON.stringify([{type:"text",text:"字".repeat(4000)}]),files,4000)[0].text.length,4000);
});

test("rejects arbitrary HTML, URLs, foreign image IDs and mismatched image contents", () => {
  for(const node of [{type:"html",html:"<script>alert(1)</script>"},{type:"image",src:"https://example.com/private"},{type:"image",fileId:"foreign-id"},{type:"image",upload:-1},{type:"image",upload:99}]){
    assert.throws(()=>parseRichContent(JSON.stringify([node]),files,4000),/无效/);
  }
  assert.throws(()=>parseRichContent('[{"type":"image","upload":0}]',[{...files[0],bytes:Buffer.from('<svg onload="alert(1)"/>')}],4000),/无效/);
  assert.throws(()=>parseRichContent('bad-json',files,4000),/格式/);
});

test("task save/read keeps rich content and file access permissions; rejected input creates no task", async () => {
  resetPeopleStore(); resetTaskStore(); setTaskNotifier(async()=>true);
  const user={username:"罗成",displayName:"罗成"};
  const draft={id:"task-rich-test-01",title:"图文任务",description:"fallback",criteria:"旧要求",assignee:"4",reviewer:"2",start_at:"2026-11-21T09:00",due_at:"2026-11-22T18:00",files,description_doc:JSON.stringify([{type:"text",text:"图前"},{type:"image",upload:0},{type:"text",text:"图后"}]),criteria_doc:JSON.stringify([{type:"text",text:"验收文字"}])};
  try{
    const created=await publishTask(user,draft);assert.equal(created.ok,true);
    const fileId=created.task.description_doc[1].fileId;
    const listed=await listTasks(user,"published");assert.deepEqual(listed.rows[0].description_doc,created.task.description_doc);assert.equal(listed.rows[0].description,"图前图后");
    const content=await readTaskFile(user,fileId);assert.equal(content.mime,"image/png");assert.equal(content.data,png.toString("base64"));
    assert.equal((await readTaskFile({username:"outsider"},fileId)).statusCode,404);
    assert.equal((await publishTask(user,{...draft,id:"task-rich-test-02",description_doc:'[{"type":"image","upload":8}]'})).ok,false);
    assert.equal((await listTasks(user,"published")).rows.length,1);
    const repeated=await publishTask(user,draft);assert.equal(repeated.duplicate,true);assert.deepEqual(repeated.task.description_doc,created.task.description_doc);
  }finally{resetTaskStore();resetPeopleStore();}
});
