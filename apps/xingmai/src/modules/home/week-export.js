import { Buffer } from "node:buffer";

// Plain values only: strings beginning with =, + or @ never become formulas.
function xml(value) {
  // eslint-disable-next-line no-control-regex
  return String(value ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const parts = [], directory = []; let offset = 0;
  for (const [name, content] of files) {
    const filename = Buffer.from(name), bytes = Buffer.from(content), crc = crc32(bytes), header = Buffer.alloc(30), entry = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24); entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
    parts.push(header, filename, bytes); directory.push(entry, filename); offset += header.length + filename.length + bytes.length;
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, index, end]);
}
function column(n) { let s = ""; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function exportWeekXlsx(pack) {
  const sheets = [...pack.teams, ...(pack.grandSummary ? [pack.grandSummary] : [])];
  const fills = ["FFFFFF", "FFF200", "5B9BD5", "BDD7EE", "00B0F0", "00B050"];
  const files = [
    ["[Content_Types].xml", `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `${declaration}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${declaration}<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><sheets>${sheets.map((s, i) => `<sheet name="${xml((s.label || s.key).slice(0, 31).replace(/[\\/?:*[\]]/g, ""))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `${declaration}<Relationships xmlns="${relationships}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${office}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="${office}/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `${declaration}<styleSheet xmlns="${spreadsheet}"><fonts count="1"><font><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills><borders count="1"><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">${[...fills, ...fills].map((_, i) => `<xf numFmtId="${i >= 6 ? 10 : 0}" fontId="0" fillId="${i % 6 + 2}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]
  ];
  sheets.forEach((team, i) => {
    const columns = pack.columns;
    const rows = [
      { values: [`${team.totalLabel || team.label} · 登记 ${pack.registrationDate || pack.ymd}`], style: 1, height: 26 },
      { values: [(team.sourceSummary || []).map(s => `${s.label} ${s.value}`).join("    ") || team.note || ""], height: 32 },
      { values: columns.map(c => c.label), header: true, height: 52 },
      ...(team.rows || []).map(row => ({ values: columns.map(c => c.key === "shop" ? row.shop : row.cells?.[c.key]) })),
      ...(team.foot || []).map(row => ({ values: columns.map(c => c.key === "shop" ? row.label : row.cells?.[c.key]), style: row.kind === "clean" ? 5 : row.kind === "noclean" ? 4 : 1 }))
    ];
    const content = rows.map((row, r) => `<row r="${r + 1}" ht="${row.height || 24}" customHeight="1">${row.values.map((v, c) => {
      const group = columns[c]?.group;
      let style = row.style ?? (row.header ? ["fee", "feeRate"].includes(group) ? 2 : ["profit", "margin", "mtd"].includes(group) ? 3 : 1 : 0);
      const metric = ["gmv", "fee", "feeRate", "profit", "mtd", "margin"].includes(group) || ["visitors", "orders", "newSku", "onSale", "jingcang", "monthSpend", "panel", "ret15", "ret30", "monthFee"].includes(columns[c]?.key);
      if (r >= 3 && metric && typeof v === "string") {
        const text = v.trim().replace(/,/g, "");
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)%$/.test(text)) { v = Number(text.slice(0, -1)) / 100; style += 6; }
        else if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) v = Number(text);
      }
      const ref = `${column(c)}${r + 1}`;
      return typeof v === "number" && Number.isFinite(v) ? `<c r="${ref}" s="${style}"><v>${v}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    files.push([`xl/worksheets/sheet${i + 1}.xml`, `${declaration}<worksheet xmlns="${spreadsheet}"><sheetViews><sheetView workbookViewId="0"><pane xSplit="6" ySplit="3" topLeftCell="G4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${columns.map((c, n) => `<col min="${n + 1}" max="${n + 1}" width="${Math.max(10, (c.w || 74) / 7)}" customWidth="1"/>`).join("")}</cols><sheetData>${content}</sheetData><mergeCells count="2"><mergeCell ref="A1:${column(columns.length - 1)}1"/><mergeCell ref="A2:${column(columns.length - 1)}2"/></mergeCells></worksheet>`]);
  });
  return zip(files);
}
