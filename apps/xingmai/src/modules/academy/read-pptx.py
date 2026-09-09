#!/usr/bin/env python3
import json
import os
import re
import shutil
import sys
import zipfile
from xml.etree import ElementTree as ET

A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def slide_index(name):
    hit = re.search(r"slide(\d+)\.xml$", name.replace("\\", "/"))
    return int(hit.group(1)) if hit else 0


def texts_of(xml):
    root = ET.fromstring(xml)
    lines = []
    for node in root.iter(A_NS + "t"):
        text = (node.text or "").strip()
        if text:
            lines.append(text)
    return lines


def images_of(zf, slide_xml_name):
    rel_name = slide_xml_name.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels"
    if rel_name not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(rel_name))
    names = []
    for rel in root:
        target = rel.attrib.get("Target") or ""
        mode = rel.attrib.get("TargetMode") or ""
        if mode.lower() == "external":
            continue
        if not re.search(r"\.(png|jpe?g|gif|webp)$", target, re.I):
            continue
        path = target.replace("\\", "/")
        if path.startswith("../"):
            path = "ppt/" + path.replace("../", "")
        elif not path.startswith("ppt/"):
            path = "ppt/slides/" + path
        names.append(path)
    return names


def extract(pptx_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    media_dir = os.path.join(out_dir, "media")
    os.makedirs(media_dir, exist_ok=True)
    pages = []
    with zipfile.ZipFile(pptx_path) as zf:
        slides = sorted(
            [name for name in zf.namelist() if re.search(r"ppt/slides/slide\d+\.xml$", name)],
            key=slide_index,
        )
        if not slides:
            raise SystemExit("PPTX 里没有幻灯片")
        used = {}
        for index, name in enumerate(slides, start=1):
            xml = zf.read(name)
            images = []
            for src in images_of(zf, name):
                base = os.path.basename(src)
                safe = re.sub(r"[^A-Za-z0-9._-]", "_", base) or "img"
                key = f"{index}-{safe}"
                if key in used:
                    continue
                used[key] = True
                if src in zf.namelist():
                    target = os.path.join(media_dir, key)
                    with zf.open(src) as src_fh, open(target, "wb") as dest_fh:
                        shutil.copyfileobj(src_fh, dest_fh)
                    images.append(key)
            pages.append({"index": index, "texts": texts_of(xml), "images": images})
    with open(os.path.join(out_dir, "pages.json"), "w", encoding="utf-8") as fh:
        json.dump({"pages": pages}, fh, ensure_ascii=False)
    print(json.dumps({"ok": True, "pages": len(pages)}))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: read-pptx.py infile.pptx outdir")
    extract(sys.argv[1], sys.argv[2])
