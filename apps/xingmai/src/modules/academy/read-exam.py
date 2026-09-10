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
TYPE_HINTS = (
    ("多选", "multi"),
    ("单选", "choice"),
    ("选择", "choice"),
    ("判断", "choice"),
    ("填空", "fill"),
    ("简答", "qa"),
    ("问答", "qa"),
    ("论述", "qa"),
    ("主观", "qa"),
    ("案例", "qa"),
    ("choice", "choice"),
    ("multi", "multi"),
    ("fill", "fill"),
    ("qa", "qa"),
    ("essay", "qa"),
)


def fail(msg):
    raise SystemExit(msg)


def letters():
    return list(KEYS[:8])


def norm_header(value):
    return re.sub(r"\s+", "", str(value or "")).strip().lower()


def clean_space(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def detect_type(text, default=""):
    blob = str(text or "")
    for word, kind in TYPE_HINTS:
        if word in blob:
            return kind
    return default


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


def split_fill_answers(raw):
    text = clean_space(raw)
    if not text:
        return []
    parts = re.split(r"[\/｜|；;、，,]|或", text)
    return [clean_space(p) for p in parts if clean_space(p)]


def option_texts(opts):
    out = []
    if isinstance(opts, dict):
        for key in letters():
            if opts.get(key) or opts.get(key.lower()):
                out.append(str(opts.get(key) or opts.get(key.lower())))
        if not out:
            out = [str(v) for v in opts.values()]
        return out
    if not isinstance(opts, list):
        return []
    for item in opts:
        if isinstance(item, dict):
            out.append(str(item.get("text") or item.get("text") or item.get("选项") or ""))
        else:
            out.append(str(item or ""))
    return out


def make_question(stem, option_texts_in, answer, qtype="", points=0, index=0):
    stem = clean_space(stem)
    if not stem:
        return None
    kind = detect_type(qtype, "")
    opts = []
    for text in option_texts_in or []:
        text = clean_space(text)
        if not text:
            continue
        key = KEYS[len(opts)]
        cleaned = re.sub(r"^[A-Ha-h][\.、．\)]\s*", "", text).strip() or text
        opts.append({"key": key, "text": cleaned})
    if not kind:
        if len(opts) >= 2:
            kind = "choice"
        elif re.search(r"_{3,}|（\s*）|\(\s*\)|【\s*】", stem):
            kind = "fill"
        else:
            kind = "qa"
    ans = clean_space(answer)
    if kind == "choice":
        if len(opts) < 2:
            if ans in ("对", "错", "正确", "错误", "是", "否"):
                opts = [{"key": "A", "text": "对"}, {"key": "B", "text": "错"}]
            else:
                kind = "qa" if not re.search(r"_{3,}", stem) else "fill"
        if kind == "choice":
            letter = re.sub(r"[^A-H]", "", ans.upper())[:1]
            keys = {item["key"]: item["text"] for item in opts}
            if letter in keys:
                answer_key = letter
            else:
                answer_key = ""
                needle = ans
                for item in opts:
                    if item["text"] == needle or item["text"] in needle or needle in item["text"]:
                        answer_key = item["key"]
                        break
            if ans in ("对", "正确", "是", "√"):
                answer_key = "A"
            if ans in ("错", "错误", "否", "×"):
                answer_key = "B"
            if not answer_key:
                fail("有选择题没有有效答案：%s" % stem[:40])
            ans = answer_key
    if kind == "fill" and not ans:
        fail("有填空题没有答案：%s" % stem[:40])
    try:
        pts = float(points or 0)
    except (TypeError, ValueError):
        pts = 0
    item = {
        "stem": stem,
        "type": kind,
        "options": opts if kind in ("choice", "multi") else [],
        "answer": ans,
        "answers": split_fill_answers(ans) if kind == "fill" else ([ans] if ans else []),
        "points": pts,
        "grade": "auto" if kind in ("choice", "multi", "fill") else "dual",
    }
    if index:
        item["index"] = index
    return item


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
    ans_i = find("答案", "正确答案", "参考答案", "answer", "key")
    type_i = find("题型", "类型", "type")
    pts_i = find("分值", "分数", "points", "分")
    opt_is = []
    for letter in letters():
        idx = find(letter.lower(), "选项" + letter.lower(), "option" + letter.lower())
        if idx >= 0:
            opt_is.append(idx)
    if stem_i < 0:
        return from_lines(["\t".join(str(x or "") for x in row) for row in rows])
    questions = []
    for row in rows[1:]:
        if not any(str(x or "").strip() for x in row):
            continue
        stem = row[stem_i] if stem_i < len(row) else ""
        options = [row[i] if i < len(row) else "" for i in opt_is]
        ans = row[ans_i] if ans_i >= 0 and ans_i < len(row) else ""
        qtype = row[type_i] if type_i >= 0 and type_i < len(row) else ""
        pts = row[pts_i] if pts_i >= 0 and pts_i < len(row) else 0
        item = make_question(stem, options, ans, qtype, pts)
        if item:
            questions.append(item)
    if not questions:
        fail("没有读到题目")
    assign_index_points(questions)
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
        item = make_question(
            row.get("stem") or row.get("题干") or row.get("题目"),
            option_texts(opts),
            row.get("answer") or row.get("答案") or row.get("参考答案"),
            row.get("type") or row.get("题型") or row.get("kind"),
            row.get("points") or row.get("分值") or 0,
        )
        if item:
            questions.append(item)
    if not questions:
        fail("JSON 里没有题目")
    assign_index_points(questions)
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


def xml_text(node):
    return "".join((t.text or "") for t in node.iter(NS_W + "t"))


def docx_lines(buf):
    with zipfile.ZipFile(io.BytesIO(buf)) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find(NS_W + "body")
    nodes = list(body) if body is not None else list(root.iter())
    lines = []
    for node in nodes:
        tag = node.tag
        if tag == NS_W + "p":
            text = clean_space(xml_text(node))
            if text:
                lines.append(text)
        elif tag == NS_W + "tbl":
            for tr in node.iter(NS_W + "tr"):
                cells = [clean_space(xml_text(tc)) for tc in tr.findall(NS_W + "tc")]
                cells = [c for c in cells if c]
                if cells:
                    lines.append("\t".join(cells))
    return lines


def is_section(line):
    return bool(
        re.match(r"^[一二三四五六七八九十]+[、.．]", line)
        or detect_type(line)
        and re.search(r"(题|部分|部分题目)", line)
        or re.match(r"^(选择题|填空题|问答题|简答题|判断题|多选题)([（(].*)?$", line)
    )


def is_answer_bank(line):
    return bool(re.match(r"^(参考答案|答案汇总|答案要点|标准答案|参考解析)", line))


def is_new_question(line):
    return bool(re.match(r"^(\d+[\.、．\)]|（\d+）|\(\d+\)|题目[:：]|题干[:：])", line))


def strip_num(line):
    return re.sub(r"^(\d+[\.、．\)]|（\d+）|\(\d+\)|题目[:：]|题干[:：])\s*", "", line).strip()


def parse_answer_line(line):
    hit = re.match(r"^(答案|正确答案|参考答案|答案要点)[:：]\s*(.*)$", line)
    if hit:
        return clean_space(hit.group(2))
    return ""


def apply_answer_bank(questions, lines):
    bank = {}
    for line in lines:
        for hit in re.finditer(r"(\d+)\s*[\.、．:：\)]\s*([^\s][^0-9]{0,80})", line):
            bank[int(hit.group(1))] = clean_space(hit.group(2))
        hit = re.match(r"^(\d+)\s*[\.、．:：\)]\s*(.+)$", line)
        if hit:
            bank[int(hit.group(1))] = clean_space(hit.group(2))
    for item in questions:
        if not item.get("answer") and item["index"] in bank:
            item["answer"] = bank[item["index"]]
            if item["type"] == "fill":
                item["answers"] = split_fill_answers(item["answer"])
            if item["type"] == "choice" and item.get("options"):
                letter = re.sub(r"[^A-H]", "", item["answer"].upper())[:1]
                if letter:
                    item["answer"] = letter


def from_lines(lines):
    blocks = []
    current = None
    section = ""
    bank_mode = False
    bank_lines = []
    for raw in lines:
        line = clean_space(raw)
        if not line or re.match(r"^(姓名|姓名[:：]|部门|得分|考试时间)", line):
            continue
        if is_answer_bank(line):
            if current:
                blocks.append(current)
                current = None
            bank_mode = True
            continue
        if bank_mode:
            bank_lines.append(line)
            continue
        if is_section(line) and not is_new_question(line):
            if current:
                blocks.append(current)
                current = None
            section = detect_type(line, section)
            continue
        if is_new_question(line):
            if current:
                blocks.append(current)
            current = {
                "stem": strip_num(line),
                "options": [],
                "answer": "",
                "type": section,
            }
            continue
        opt = re.match(r"^([A-Ha-h])[\.、．\)]\s*(.+)$", line)
        if opt and current:
            current["options"].append(opt.group(2).strip())
            continue
        ans = parse_answer_line(line)
        if ans and current:
            current["answer"] = ans
            continue
        if current:
            if not current["options"]:
                current["stem"] = (current["stem"] + " " + line).strip()
            else:
                current["options"][-1] = (current["options"][-1] + " " + line).strip()
            continue
        fake = re.match(r"^(.+?)\t+(.+)$", line)
        if fake and not headerish(line):
            current = {
                "stem": fake.group(1),
                "options": [],
                "answer": fake.group(2),
                "type": section or "qa",
            }
            blocks.append(current)
            current = None
    if current:
        blocks.append(current)
    questions = []
    for block in blocks:
        item = make_question(block["stem"], block["options"], block["answer"], block.get("type") or "")
        if item:
            questions.append(item)
    if not questions:
        fail("文档里没有识别出题目。Word 可直接导入：选择题、填空、问答都认。答案写在题后「答案：」或文末「参考答案」。")
    assign_index_points(questions)
    if bank_lines:
        apply_answer_bank(questions, bank_lines)
        for item in questions:
            if item["type"] == "choice" and item.get("options") and not re.match(r"^[A-H]$", str(item.get("answer") or "")):
                rebuilt = make_question(item["stem"], [o["text"] for o in item["options"]], item.get("answer"), "choice", item.get("points") or 0)
                if rebuilt:
                    item["answer"] = rebuilt["answer"]
            if item["type"] == "fill":
                item["answers"] = split_fill_answers(item.get("answer"))
            if item["type"] == "choice" and not item.get("answer"):
                fail("有选择题没有有效答案：%s" % item["stem"][:40])
            if item["type"] == "fill" and not item.get("answer"):
                fail("有填空题没有答案：%s" % item["stem"][:40])
    return questions


def headerish(line):
    return "题干" in line and "答案" in line


def assign_index_points(questions):
    leftover = [q for q in questions if not q.get("points")]
    used = sum(float(q.get("points") or 0) for q in questions)
    remain = max(0, 100 - used)
    if leftover:
        each = round(remain / len(leftover), 2) if remain else 0
        for i, item in enumerate(leftover):
            item["points"] = each if i < len(leftover) - 1 else round(remain - each * (len(leftover) - 1), 2)
    total = sum(float(q.get("points") or 0) for q in questions) or 1
    if abs(total - 100) > 0.05 and not leftover:
        for item in questions:
            item["points"] = round(100 * float(item["points"]) / total, 2)
    for i, item in enumerate(questions, start=1):
        item["index"] = i
        item["grade"] = "auto" if item["type"] in ("choice", "multi", "fill") else "dual"


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
