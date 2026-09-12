import { inflateRawSync } from "node:zlib";

const HEADER_ALIASES = [
  ["spu", ["spu", "spu编码", "spu编号", "商品编码", "商品编号", "商品id", "货号", "商品id/spu"]],
  ["firstSku", ["sku", "sku编码", "sku编号", "第一个sku", "商品sku", "skuid"]],
  ["name", ["商品名称", "标题", "商品标题", "sku名称"]],
  ["image", ["主图", "图片", "商品图片", "图片链接"]],
  ["reviewCount", ["评价数", "评论数", "评价"]],
  ["shareCount", ["晒单数", "晒单"]],
  ["returnM8", ["退货率", "退款率", "售后率", "退货退款率", "bi8月退货率", "bi 8月退货率"]],
  ["returnM7", ["bi7月退货率", "bi 7月退货率"]],
  ["returnM6", ["bi6月退货率", "bi 6月退货率"]],
  ["returnM5", ["bi5月退货率", "bi 5月退货率"]],
  ["spendRate", ["推广花费占比", "花费占比", "推广费占比", "投产花费占比", "费比"]],
  ["gmv7d", ["近7天日成交金额", "日成交金额", "日均成交金额", "近7天日均成交", "日均成交"]],
  ["periodGmv", ["成交金额", "成交额", "gmv", "支付金额", "销售额"]],
  ["weekGmv", ["近7天成交金额", "近7日成交金额", "7日成交金额"]],
  ["convRate", ["成交转化率", "转化率", "成交转化率%", "下单转化率"]],
  ["orders30d", ["成交单量", "成交订单数", "成交订单量", "近30天真实单量", "订单量", "成交笔数"]],
  ["price", ["价格", "商品价格", "成交客单价", "客单价"]],
  ["listedOn", ["上架时间", "上柜时间"]],
  ["remark", ["备注"]],
  ["hotSell", ["全网热销"]],
  ["jdStock", ["京仓库存", "库存"]],
  ["layer", ["分层"]],
];

export function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]【】]/g, "")
    .replace(/%/g, "")
    .replace(/[:：].*$/g, "")
    .toLowerCase();
}

export function parseOverviewFilename(name = "") {
  const text = String(name || "").replace(/\\/g, "/").split("/").pop();
  const match = text.match(/商品总览[_-]?京东[_-](.+?)[_-](\d{4}-\d{2}-\d{2})[_-](\d{4}-\d{2}-\d{2})/);
  if (!match) {
    return { shop: "", from: "", to: "", days: 0 };
  }
  const from = match[2];
  const to = match[3];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    ? Math.max(1, Math.round((end - start) / 86400000) + 1)
    : 0;
  return { shop: match[1], from, to, days };
}

function headerKey(label) {
  const normalized = normalizeHeader(label);
  if (!normalized) {
    return "";
  }
  for (const [key, aliases] of HEADER_ALIASES) {
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return "";
}

function colLettersToIndex(letters) {
  let n = 0;
  for (const ch of String(letters || "").toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function xmlDecode(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  const out = [];
  const blocks = String(xml || "").match(/<si\b[\s\S]*?<\/si>/g) || [];
  blocks.forEach((block) => {
    const texts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1]));
    out.push(texts.join(""));
  });
  return out;
}

function parseSheetRows(xml, shared) {
  const rows = [];
  const rowBlocks = String(xml || "").match(/<row\b[\s\S]*?<\/row>/g) || [];
  rowBlocks.forEach((block) => {
    const rowMatch = block.match(/<row\b[^>]*\br="(\d+)"/);
    const rowIndex = rowMatch ? Number(rowMatch[1]) - 1 : rows.length;
    const row = [];
    const cells = block.match(/<c\b[\s\S]*?<\/c>|<c\b[^>]*\/>/g) || [];
    cells.forEach((cell) => {
      const ref = (cell.match(/\br="([A-Z]+)(\d+)"/i) || [])[1];
      const col = ref ? colLettersToIndex(ref) : row.length;
      const type = (cell.match(/\bt="([^"]+)"/) || [])[1] || "";
      let value = "";
      if (type === "inlineStr") {
        const texts = [...cell.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1]));
        value = texts.join("");
      } else {
        const raw = (cell.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
        if (raw == null) {
          value = "";
        } else if (type === "s") {
          value = shared[Number(raw)] ?? "";
        } else {
          value = xmlDecode(raw);
        }
      }
      row[col] = value;
    });
    rows[rowIndex] = row;
  });
  return rows;
}

function findEocd(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

function inflateZipEntry(method, packed) {
  if (method === 0) {
    return packed;
  }
  if (method === 8) {
    return inflateRawSync(packed);
  }
  throw new Error("unsupported zip compression");
}

function readZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const files = {};
  const eocd = findEocd(buf);
  if (eocd >= 0) {
    const count = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);
    for (let i = 0; i < count && offset + 46 <= buf.length; i += 1) {
      if (buf.readUInt32LE(offset) !== 0x02014b50) {
        break;
      }
      const method = buf.readUInt16LE(offset + 10);
      const compSize = buf.readUInt32LE(offset + 20);
      const nameLen = buf.readUInt16LE(offset + 28);
      const extraLen = buf.readUInt16LE(offset + 30);
      const commentLen = buf.readUInt16LE(offset + 32);
      const localOff = buf.readUInt32LE(offset + 42);
      const name = buf.slice(offset + 46, offset + 46 + nameLen).toString("utf8");
      const localNameLen = buf.readUInt16LE(localOff + 26);
      const localExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + localNameLen + localExtraLen;
      files[name] = inflateZipEntry(method, buf.slice(start, start + compSize)).toString("utf8");
      offset += 46 + nameLen + extraLen + commentLen;
    }
    if (Object.keys(files).length) {
      return files;
    }
  }
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      break;
    }
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.slice(offset + 30, offset + 30 + nameLen).toString("utf8");
    const start = offset + 30 + nameLen + extraLen;
    files[name] = inflateZipEntry(method, buf.slice(start, start + compSize)).toString("utf8");
    offset = start + compSize;
  }
  return files;
}

function firstSheetPath(files) {
  const sheetNames = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort();
  return sheetNames[0] || "";
}

export function parseXlsxRows(buffer) {
  const files = readZip(buffer);
  const sheetPath = firstSheetPath(files);
  if (!sheetPath) {
    throw Object.assign(new Error("xlsx 里没有工作表"), { statusCode: 400 });
  }
  const shared = parseSharedStrings(files["xl/sharedStrings.xml"] || "");
  return parseSheetRows(files[sheetPath], shared);
}

function scoreHeaderRow(row) {
  return (row || []).reduce((sum, cell) => sum + (headerKey(cell) ? 1 : 0), 0);
}

function pickHeaderIndex(rows) {
  let best = 0;
  let score = -1;
  rows.slice(0, 20).forEach((row, i) => {
    const n = scoreHeaderRow(row);
    if (n > score) {
      score = n;
      best = i;
    }
  });
  return { index: best, score };
}

function excelSerialToDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) {
    return String(value ?? "").trim();
  }
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return date.toISOString().slice(0, 10);
}

function dailyGmv(row, days) {
  if (row.gmv7d) {
    return row.gmv7d;
  }
  const week = Number(String(row.weekGmv || "").replace(/,/g, ""));
  if (Number.isFinite(week) && week > 0) {
    return String(Math.round((week / 7) * 100) / 100);
  }
  const period = Number(String(row.periodGmv || "").replace(/,/g, ""));
  if (Number.isFinite(period) && period > 0 && days > 0) {
    return String(Math.round((period / days) * 100) / 100);
  }
  return "";
}

export function mapOverviewRows(rows, { filename = "" } = {}) {
  const meta = parseOverviewFilename(filename);
  const { index, score } = pickHeaderIndex(rows);
  if (score < 2) {
    const err = new Error("识别不出商品总览表头，请确认是京东商品总览导出");
    err.statusCode = 400;
    throw err;
  }
  const headers = (rows[index] || []).map((cell) => headerKey(cell));
  const items = [];
  rows.slice(index + 1).forEach((row) => {
    const item = {};
    headers.forEach((key, i) => {
      if (!key) {
        return;
      }
      const value = row[i] == null ? "" : String(row[i]).trim();
      if (value) {
        item[key] = key === "listedOn" ? excelSerialToDate(value) : value;
      }
    });
    item.gmv7d = dailyGmv(item, meta.days);
    delete item.periodGmv;
    delete item.weekGmv;
    if (item.spu || item.firstSku || item.name) {
      items.push(item);
    }
  });
  return { items, meta, headers: (rows[index] || []).map((cell) => String(cell ?? "").trim()) };
}

export function parseOverviewWorkbook(file, filename = "") {
  const name = filename || "";
  if (/\.csv$/i.test(name)) {
    const err = new Error("csv 请走原来的导入");
    err.statusCode = 400;
    throw err;
  }
  return mapOverviewRows(parseXlsxRows(file), { filename: name });
}

export function makeMinimalXlsx(aoa) {
  const shared = [];
  const sharedIndex = new Map();
  function share(text) {
    const key = String(text);
    if (sharedIndex.has(key)) {
      return sharedIndex.get(key);
    }
    const i = shared.length;
    shared.push(key);
    sharedIndex.set(key, i);
    return i;
  }
  const sheetRows = aoa
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = colIndexToLetters(c) + (r + 1);
          if (value == null || value === "") {
            return "";
          }
          if (typeof value === "number") {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          return `<c r="${ref}" t="s"><v>${share(value)}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const sst = shared
    .map((text) => `<si><t>${escapeXml(text)}</t></si>`)
    .join("");
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="商品总览" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${sst}</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return zipStore(files);
}

function colIndexToLetters(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ~crc >>> 0;
}

function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  Object.entries(files).forEach(([name, text]) => {
    const data = Buffer.from(text, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  });
  const centralStart = offset;
  const centralBufs = central;
  const centralSize = centralBufs.reduce((sum, buf) => sum + buf.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...chunks, ...centralBufs, end]);
}
