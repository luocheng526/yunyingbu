#!/usr/bin/env python3
import csv
import io
import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def fail(msg):
    raise SystemExit(msg)


def letters():
    return list(KEYS[:8])


def norm_header(value):
    return re.sub(r"\s+", "", str(value or "")).strip().lower()


def cell_col_row(ref):
    hit = re.match(r"^([A-Z]+)(\d+)$", str(ref or "").upper())
    if not hit:
        return "", 0
    return hit.group(1), int(hit.group(2))


def col_index(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def as_question(stem, option_texts, answer):
    stem = str(stem or "").strip()
    opts = []
    for i, text in enumerate(option_texts):
        text = str(text or "").strip()
        if not text:
            continue
        key = KEYS[len(opts)]
        cleaned = re.sub(r"^[A-Ha-h][\.、．\)]\s*", "", text).strip() or text
        opts.append({"key": key, "text": cleaned})
    ans = str(answer or "").strip().upper()
    ans = re.sub(r"[^A-H]", "", ans)[:1] or str(answer or "").strip()
    if not stem or len(opts) < 2:
        return None
    keys = {item["key"]: item["text"] for item in opts}
    if ans in keys:
        answer_key = ans
    else:
        answer_key = ""
        needle = str(answer or "").strip()
        for item in opts:
            if item["text"] == needle or item["text"] in needle or needle in item["text"]:
                answer_key = item["key"]
                break
    if not answer_key:
        fail("有题目没有有效答案：%s" % stem[:40])
    return {"stem": stem, "options": opts, "answer": answer_key}


def from_rows(rows):
    if not rows:
        fail("考试文档是空的")
    header = [norm_header(x) for x in rows[0]]

    def find(*names):
        for name in names:
            if name in header:
                return header.index(name)
        return -1

    stem_i = find("题干", "题目", "stem", "question")
    ans_i = find("答案", "正确答案", "answer", "key")
    opt_is = []
    for letter in letters():
        idx = find(letter.lower(), "选项" + letter.lower(), "option" + letter.lower())
        if idx >= 0:
            opt_is.append(idx)
    if stem_i < 0:
        fail("表头需要「题干」列（或 stem）")
    if ans_i < 0:
        fail("表头需要「答案」列（或 answer）")
    if len(opt_is) < 2:
        fail("表头至少要有 A、B 两列选项")
    questions = []
    for row in rows[1:]:
        if not any(str(x or "").strip() for x in row):
            continue
        stem = row[stem_i] if stem_i < len(row) else ""
        options = [row[i] if i < len(row) else "" for i in opt_is]
        ans = row[ans_i] if ans_i < len(row) else ""
        item = as_question(stem, options, ans)
        if item:
            questions.append(item)
    if not questions:
        fail("没有读到题目")
    for i, item in enumerate(questions, start=1):
        item["index"] = i
    return questions


def from_json(raw):
    data = json.loads(raw)
    if isinstance(data, dict):
        data = data.get("questions") or data.get("题目") or data.get("items")
    if not isinstance(data, list):
        fail("JSON 需要 questions 数组")
    questions = []
    for row in data:
        if not isinstance(row, dict):
            continue
        opts = row.get("options") or row.get("选项") or []
        if not opts:
            opts = [row.get(k) or row.get(k.lower()) for k in letters()]
        item = as_question(
            row.get("stem") or row.get("题干") or row.get("题目"),
            opts,
            row.get("answer") or row.get("答案"),
        )
        if item:
            questions.append(item)
    if not questions:
        fail("JSON 里没有题目")
    for i, item in enumerate(questions, start=1):
        item["index"] = i
    return questions


def from_csv(raw):
    text = raw.decode("utf-8-sig") if isinstance(raw, bytes) else str(raw)
    reader = csv.reader(io.StringIO(text))
    return from_rows([list(row) for row in reader])


def xlsx_strings(zf):
    name = "xl/sharedStrings.xml"
    if name not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(name))
    out = []
    for si in root.findall("%ssi" % NS_MAIN):
        texts = [node.text or "" for node in si.iter(NS_MAIN + "t")]
        out.append("".join(texts))
    return out


def xlsx_sheet(zf):
    names = [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
    if not names:
        fail("xlsx 里没有工作表")
    names.sort()
    return zf.read(names[0])


def from_xlsx(buf):
    with zipfile.ZipFile(io.BytesIO(buf)) as zf:
        shared = xlsx_strings(zf)
        root = ET.fromstring(xlsx_sheet(zf))
        grid = {}
        max_row = 0
        max_col = 0
        for cell in root.iter(NS_MAIN + "c"):
            ref = cell.attrib.get("r") or ""
            col, row = cell_col_row(ref)
            if not col or not row:
                continue
            kind = cell.attrib.get("t") or ""
            value = ""
            if kind == "s":
                v = cell.findtext(NS_MAIN + "v") or "0"
                try:
                    value = shared[int(v)]
                except (ValueError, IndexError):
                    value = ""
            elif kind == "inlineStr":
                value = "".join(node.text or "" for node in cell.iter(NS_MAIN + "t"))
            else:
                value = cell.findtext(NS_MAIN + "v") or ""
            ci = col_index(col)
            grid[(row, ci)] = value
            max_row = max(max_row, row)
            max_col = max(max_col, ci)
        rows = []
        for r in range(1, max_row + 1):
            rows.append([grid.get((r, c), "") for c in range(max_col + 1)])
        return from_rows(rows)


def docx_lines(buf):
    with zipfile.ZipFile(io.BytesIO(buf)) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(NS_W + "p"):
        text = "".join(node.text or "" for node in p.iter(NS_W + "t")).strip()
        if text:
            lines.append(text)
    return lines


def from_lines(lines):
    blocks = []
    current = None
    for line in lines:
        line = str(line or "").strip()
        if not line:
            continue
        if re.match(r"^(\d+[\.、．)]|题目[:：]|题干[:：])", line):
            if current:
                blocks.append(current)
            current = {"stem": re.sub(r"^(\d+[\.、．)]|题目[:：]|题干[:：])\s*", "", line), "options": [], "answer": ""}
            continue
        opt = re.match(r"^([A-Ha-h])[\.、．\)]\s*(.+)$", line)
        if opt and current:
            current["options"].append(opt.group(2).strip())
            continue
        ans = re.match(r"^(答案|正确答案)[:：]\s*(.+)$", line)
        if ans and current:
            current["answer"] = ans.group(2).strip()
            continue
        if current and not current["options"]:
            current["stem"] = (current["stem"] + " " + line).strip()
    if current:
        blocks.append(current)
    questions = []
    for block in blocks:
        item = as_question(block["stem"], block["options"], block["answer"])
        if item:
            questions.append(item)
    if not questions:
        fail("文档里没有识别出题目。请用表头题干/A/B/C/D/答案，或「1. 题干 / A. 选项 / 答案：A」")
    for i, item in enumerate(questions, start=1):
        item["index"] = i
    return questions


def sniff_and_parse(path):
    name = os.path.basename(path).lower()
    with open(path, "rb") as fh:
        buf = fh.read()
    if name.endswith(".json"):
        return from_json(buf.decode("utf-8-sig"))
    if name.endswith(".csv"):
        return from_csv(buf)
    if name.endswith(".xlsx"):
        return from_xlsx(buf)
    if name.endswith(".docx"):
        return from_lines(docx_lines(buf))
    if name.endswith(".txt") or name.endswith(".md"):
        text = buf.decode("utf-8-sig")
        return from_lines(text.splitlines())
    fail("请上传 .xlsx / .csv / .json / .docx / .txt 考试文档")


def extract(src, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    questions = sniff_and_parse(src)
    payload = {"questions": questions}
    with open(os.path.join(out_dir, "questions.json"), "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps({"ok": True, "questions": len(questions)}, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: read-exam.py infile outdir")
    extract(sys.argv[1], sys.argv[2])
