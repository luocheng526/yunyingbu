import { PHASE2_GAPS, toolMyShops, toolPersonStatus, toolShopOperators } from "./tools.js";
import { canCallRemote } from "./models.js";

const MAX_HISTORY = 12;

export const GREETING =
  "我是运营部主脑问答台。花名册只读：在职、店归谁、你能看见哪些店。选品、做店、日常可以聊通用方法；后台配了 GPT 后，下拉框就能选模型展开聊。店近30天、商学院课表、外数还没有接口，不会编数字。不做改价、退款、发版。";

const REFUSE_HINT = /改价|调价|退款|发版|上线|点通过|通过单据|发布版本/;
const MY_SHOPS_HINT = /我(能看|可以看|有哪些店|的店|店权)|当前用户.*店|看见哪些店/;
const STATUS_HINT = /在职|离职|还在吗|还在不|还干不|是否在职/;
const SHOP_OPS_HINT = /归谁|归哪些|哪些运营|谁管|谁负责|管辖/;
const SITE_GAP_HINT = /近\s*30\s*天|三十天|近一个月|gmv|成交额|外数|商学院|课件|课程检索|培训知识|任务列表/i;
const PICK_HINT = /选品|爆款|测款|测图|排期|达人|新品/;
const STORE_HINT = /做店|开店|店铺运营|日销|直通车|投放|主图|标题|客服|售后/;

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

export function classifyQuestion(text) {
  const question = String(text || "");
  if (REFUSE_HINT.test(question)) {
    return "refuse";
  }
  if (MY_SHOPS_HINT.test(question)) {
    return "myShops";
  }
  if (STATUS_HINT.test(question)) {
    return "personStatus";
  }
  if (SHOP_OPS_HINT.test(question) || (/店/.test(question) && /运营|店长|主管/.test(question))) {
    return "shopOps";
  }
  if (SITE_GAP_HINT.test(question)) {
    return "siteGap";
  }
  return "opsChat";
}

function extractPersonName(text, people) {
  const ordered = [...people].sort((a, b) => b.name.length - a.name.length);
  for (const person of ordered) {
    if (person.name && text.includes(person.name)) {
      return person.name;
    }
  }
  const match = text.match(/([\u4e00-\u9fa5]{2,4})(?=在职|离职|还在|还干)/);
  return match ? match[1] : "";
}

function extractShopName(text, shops) {
  const ordered = [...shops].sort((a, b) => b.name.length - a.name.length);
  for (const shop of ordered) {
    if (shop.name && text.includes(shop.name)) {
      return shop.name;
    }
  }
  const fuzzy = text.match(/「([^」]{2,32})」|“([^”]{2,32})”/);
  return (fuzzy && (fuzzy[1] || fuzzy[2])) || "";
}

function lastEntity(history, kind) {
  const rows = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const meta = rows[i] && rows[i].meta ? rows[i].meta : {};
    if (kind === "person" && meta.personName) {
      return meta.personName;
    }
    if (kind === "shop" && meta.shopName) {
      return meta.shopName;
    }
  }
  return "";
}

function compose(lines, sources, gaps) {
  const body = lines.filter(Boolean).join("\n");
  const extra = [];
  if (gaps && gaps.length) {
    extra.push("还没有：\n- " + gaps.join("\n- "));
  }
  extra.push("依据：" + unique(sources).join("、") + "。本店数字没有接口就不编，也不爬页面。");
  return [body, extra.join("\n")].filter(Boolean).join("\n\n");
}

export function opsPlaybook(text, files) {
  const fileLine =
    files && files.length
      ? `已引用上传文件 ${files.map((item) => "#" + item.id + " " + item.filename).join("、")}。文件只当补充材料，不当成全站数据。`
      : "";
  if (PICK_HINT.test(text)) {
    return compose(
      [
        fileLine,
        "选品先定人群和场景，再看竞品转化、退货、评价，不要只看销量。",
        "测款用小预算看点击和加购；达人排期跟内容匹配，不跟风堆品。",
        "这是通用方法。本店近30天数字还没有只读接口，后台 GPT 可以帮你把方案拆细，但不会编本店成交。"
      ],
      ["通用运营方法"],
      []
    );
  }
  if (STORE_HINT.test(text)) {
    return compose(
      [
        fileLine,
        "做店按日节奏：流量、转化、售后、库存。主图和标题先保证搜得着、看得懂。",
        "店权和花名册问本站；经营数字等数据中心开口。",
        "后台配了 GPT，下拉选模型就能把一天的动作拆成清单。"
      ],
      ["通用运营方法"],
      []
    );
  }
  return compose(
    [
      fileLine,
      "可以聊选品、做店、日常动作。花名册三件事仍走本站只读：在职、店归谁、你能看见哪些店。",
      "后台写入 XM_AGENTS_API_KEY 或 OPENAI_API_KEY 后，模型下拉可选 GPT，密钥不会进浏览器。"
    ],
    ["通用运营方法"],
    []
  );
}

export async function runDesk({ text, viewer, history, files, roster }) {
  const question = String(text || "").trim();
  const sources = [];
  const tools = [];
  const meta = {};
  const people = roster?.people || [];
  const shops = roster?.shops || [];
  const mode = classifyQuestion(question);

  if (!question) {
    return { mode: "opsChat", text: "请输入问题。", sources: [], gaps: [], tools, meta, refused: false };
  }

  if (mode === "refuse") {
    return {
      mode,
      text: "这是问答台，不做改价、退款或发版。改价去业务中心，退款走原流程，发版只去版本发布中心排队点通过。",
      sources: ["本模块纪律"],
      gaps: [],
      tools,
      meta: { refused: true },
      refused: true
    };
  }

  if (mode === "siteGap") {
    return {
      mode,
      text: compose(["这类本站经营数字/课表还没有只读接口，不能答具体数，也不会去爬页面。选品、做店的方法可以另问。"], ["本模块缺口清单"], PHASE2_GAPS),
      sources: ["本模块缺口清单"],
      gaps: PHASE2_GAPS,
      tools,
      meta: { gap: true },
      refused: false
    };
  }

  if (mode === "myShops") {
    const result = await toolMyShops(viewer);
    tools.push({ name: "myShops", result });
    sources.push(result.source);
    return { mode, text: compose([result.text], sources, []), sources, gaps: [], tools, meta, refused: false };
  }

  if (mode === "personStatus") {
    const name = extractPersonName(question, people) || lastEntity(history, "person");
    if (!name) {
      return {
        mode,
        text: compose(["请说出花名册上的姓名，例如「张文静在职吗」。"], ["人员花名册只读"], []),
        sources: ["人员花名册只读"],
        gaps: [],
        tools,
        meta,
        refused: false
      };
    }
    const result = await toolPersonStatus(name);
    tools.push({ name: "personStatus", input: name, result });
    sources.push(result.source);
    meta.personName = result.name || name;
    return { mode, text: compose([result.text], sources, []), sources, gaps: [], tools, meta, refused: false };
  }

  if (mode === "shopOps") {
    const shopName = extractShopName(question, shops) || lastEntity(history, "shop");
    if (!shopName) {
      return {
        mode,
        text: compose(["请说出花名册上的店名，例如「飒望居家旗舰店归哪些运营」。"], ["人员花名册只读"], []),
        sources: ["人员花名册只读"],
        gaps: [],
        tools,
        meta,
        refused: false
      };
    }
    const result = await toolShopOperators(viewer, shopName);
    tools.push({ name: "shopOperators", input: shopName, result });
    sources.push(result.source);
    meta.shopName = result.shop || shopName;
    return {
      mode,
      text: compose([result.text], sources, []),
      sources,
      gaps: [],
      tools,
      meta,
      refused: Boolean(result.forbidden)
    };
  }

  return {
    mode: "opsChat",
    text: opsPlaybook(question, files),
    sources: ["通用运营方法"],
    gaps: [],
    tools,
    meta: { fileIds: (files || []).map((item) => item.id) },
    refused: false
  };
}

function fileExcerpt(file) {
  const mime = String(file.mime || "");
  const buf = file.content;
  if (!buf || !/^text\/|^application\/(json|xml)/i.test(mime)) {
    return `#${file.id} ${file.filename}（非文本，只引用 id）`;
  }
  const text = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
  const clipped = text.replace(/\s+/g, " ").trim().slice(0, 1500);
  return `#${file.id} ${file.filename} 摘录：${clipped}`;
}

export async function chatWithModel(model, { question, history, desk, files }, fetchImpl = fetch) {
  if (!canCallRemote(model)) {
    return desk.text;
  }
  const url = model.base + "/chat/completions";
  const prior = (history || [])
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(-MAX_HISTORY)
    .map((item) => ({ role: item.role, content: String(item.text || "").slice(0, 2000) }));
  const facts = desk && desk.text ? desk.text : "无本站核实内容。";
  const uploads = (files || []).map(fileExcerpt).join("\n");
  const messages = [
    {
      role: "system",
      content:
        "你是星脉甄选运营部主脑助手。可以聊选品、做店、日常运营。本站事实只能用「已核实」里的内容；店近30天数字、商学院课表、外数没有接口就必须说还没有，不准编。不做改价、退款、发版。不要输出密钥。"
    },
    ...prior,
    {
      role: "user",
      content: `已核实：\n${facts}\n\n用户上传：\n${uploads || "无"}\n\n用户问：\n${question}`
    }
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + model.key
      },
      body: JSON.stringify({
        model: model.id,
        temperature: 0.4,
        messages
      })
    });
    if (!res.ok) {
      return desk.text + "\n\n（后台模型未接通，以上是本站问答台原文。检查服务里的 XM_AGENTS_API_KEY / OPENAI_API_KEY。）";
    }
    const data = await res.json();
    const text =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? String(data.choices[0].message.content || "").trim()
        : "";
    return text || desk.text;
  } catch {
    return desk.text + "\n\n（后台模型未接通，以上是本站问答台原文。）";
  } finally {
    clearTimeout(timer);
  }
}

export function shouldUseRemote(model, desk) {
  return canCallRemote(model) && desk && desk.mode === "opsChat" && !desk.refused;
}

export async function phraseWithModel(model, desk, extras = {}, fetchImpl = fetch) {
  if (!shouldUseRemote(model, desk)) {
    return desk.text;
  }
  return chatWithModel(
    model,
    {
      question: extras.question || extras.text || "",
      history: extras.history || [],
      desk,
      files: extras.files || []
    },
    fetchImpl
  );
}
