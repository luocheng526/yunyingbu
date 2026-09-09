import { PHASE2_GAPS, toolMyShops, toolPersonStatus, toolShopOperators } from "./tools.js";
import { DESK_ID } from "./models.js";

const MAX_HISTORY = 12;

export const GREETING =
  "我是运营部主脑问答台。第一期只查人员花名册只读接口：某人是否在职、某店归哪些在职运营、你能看见哪些店。店近30天、商学院、外数还没有只读接口，不会编造，也不会改价、退款或发版。";

const GAP_HINT = /近\s*30\s*天|三十天|近一个月|gmv|成交额|外数|商学院|课件|课程检索|培训知识|任务列表|选品排期|商品成长/i;
const REFUSE_HINT = /改价|调价|退款|发版|上线|点通过|通过单据|发布版本/i;
const MY_SHOPS_HINT = /我(能看|可以看|有哪些店|的店|店权)|当前用户.*店|看见哪些店/;
const STATUS_HINT = /在职|离职|还在吗|还在不|还干不/;
const SHOP_OPS_HINT = /归谁|归哪些|哪些运营|谁管|谁负责|管辖/;

function unique(list) {
  return [...new Set(list.filter(Boolean))];
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
  extra.push("依据：" + unique(sources).join("、") + "。没有接口的数不编造，也不爬页面。");
  return [body, extra.join("\n")].filter(Boolean).join("\n\n");
}

export async function runDesk({ text, viewer, history, files, roster }) {
  const question = String(text || "").trim();
  const sources = [];
  const tools = [];
  const gaps = [];
  const meta = {};
  const people = roster?.people || [];
  const shops = roster?.shops || [];

  if (!question) {
    return { text: "请输入问题。", sources: [], gaps: [], tools, meta, refused: false };
  }

  if (REFUSE_HINT.test(question)) {
    return {
      text: "这是问答台，不做改价、退款或发版。改价去业务中心，退款走原流程，发版只去版本发布中心排队点通过。",
      sources: ["本模块纪律"],
      gaps: [],
      tools,
      meta: { refused: true },
      refused: true
    };
  }

  if (GAP_HINT.test(question) && !STATUS_HINT.test(question) && !SHOP_OPS_HINT.test(question) && !MY_SHOPS_HINT.test(question)) {
    return {
      text: compose(["这类数据本站还没有只读接口，第一期不能答，也不会去爬页面或灌全站。"], ["本模块缺口清单"], PHASE2_GAPS),
      sources: ["本模块缺口清单"],
      gaps: PHASE2_GAPS,
      tools,
      meta: { gap: true },
      refused: false
    };
  }

  if (MY_SHOPS_HINT.test(question)) {
    const result = await toolMyShops(viewer);
    tools.push({ name: "myShops", result });
    sources.push(result.source);
    return {
      text: compose([result.text], sources, []),
      sources,
      gaps: [],
      tools,
      meta,
      refused: false
    };
  }

  if (STATUS_HINT.test(question) || /是否在职/.test(question)) {
    const name = extractPersonName(question, people) || lastEntity(history, "person");
    if (!name) {
      return {
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
    return {
      text: compose([result.text], sources, []),
      sources,
      gaps: [],
      tools,
      meta,
      refused: false
    };
  }

  if (SHOP_OPS_HINT.test(question) || /店/.test(question) && /运营|店长|主管/.test(question)) {
    const shopName = extractShopName(question, shops) || lastEntity(history, "shop");
    if (!shopName) {
      return {
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
      text: compose([result.text], sources, []),
      sources,
      gaps: [],
      tools,
      meta,
      refused: Boolean(result.forbidden)
    };
  }

  if (files && files.length) {
    const names = files.map((item) => `#${item.id} ${item.filename}`).join("、");
    return {
      text: compose(
        [
          `已收到上传文件 ${names}。对话只引用文件 id，不会把文件当成全站数据。`,
          "第一期能查的仍是花名册：在职、店归谁、你能看见哪些店。"
        ],
        ["本模块上传", "人员花名册只读"],
        PHASE2_GAPS
      ),
      sources: ["本模块上传"],
      gaps: PHASE2_GAPS,
      tools,
      meta: { fileIds: files.map((item) => item.id) },
      refused: false
    };
  }

  return {
    text: compose(
      [
        "第一期只能根据人员花名册只读接口回答三件事：某人是否在职、某店归哪些在职运营、你能看见哪些店。",
        "店近30天、商学院、外数还没有接口，我不会编。"
      ],
      ["人员花名册只读"],
      PHASE2_GAPS
    ),
    sources: ["人员花名册只读"],
    gaps: PHASE2_GAPS,
    tools,
    meta,
    refused: false
  };
}

export async function phraseWithModel(model, desk) {
  if (!model || model.id === DESK_ID || !model.key || !model.base) {
    return desk.text;
  }
  const url = String(model.base).replace(/\/+$/, "") + "/chat/completions";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + model.key
      },
      body: JSON.stringify({
        model: model.id,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "只准复述用户提供的事实，不准增加人名、店名、数字。没有的事实就说还没有。不要输出密钥。"
          },
          { role: "user", content: desk.text }
        ]
      })
    });
    if (!res.ok) {
      return desk.text + "\n\n（配置模型未接通，以上为本站只读问答台原文。）";
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || "").trim()
      : "";
    return text || desk.text;
  } catch {
    return desk.text + "\n\n（配置模型未接通，以上为本站只读问答台原文。）";
  } finally {
    clearTimeout(timer);
  }
}
