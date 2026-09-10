#!/usr/bin/env python3
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
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


def render_soffice(pptx_path, media_dir, count):
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    pdftoppm = shutil.which("pdftoppm")
    if not soffice or not pdftoppm:
        return False
    work = tempfile.mkdtemp(prefix="xm-ppt-")
    env = os.environ.copy()
    env["HOME"] = work
    env["LANG"] = env.get("LANG") or "C.UTF-8"
    try:
        subprocess.check_call(
            [soffice, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", work, pptx_path],
            timeout=150,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
        )
        pdfs = [name for name in os.listdir(work) if name.lower().endswith(".pdf")]
        if not pdfs:
            return False
        prefix = os.path.join(work, "slide")
        subprocess.check_call(
            [pdftoppm, "-png", "-r", "120", os.path.join(work, pdfs[0]), prefix],
            timeout=150,
            env=env,
        )
        files = sorted(
            [name for name in os.listdir(work) if name.startswith("slide") and name.endswith(".png")],
            key=lambda n: int(re.search(r"(\d+)", n).group(1) if re.search(r"(\d+)", n) else 0),
        )
        if not files:
            return False
        for index, name in enumerate(files, start=1):
            shutil.copyfile(os.path.join(work, name), os.path.join(media_dir, "slide-%d.png" % index))
        return len(files) >= count
    except Exception:
        return False
    finally:
        shutil.rmtree(work, ignore_errors=True)


def render_fallback(pages, media_dir):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        Image = None
    W, H = 1280, 720
    for page in pages:
        name = "slide-%d.png" % page["index"]
        target = os.path.join(media_dir, name)
        pasted = False
        if Image is not None:
            canvas = Image.new("RGB", (W, H), (255, 255, 255))
            for img_name in page.get("images") or []:
                src = os.path.join(media_dir, img_name)
                if not os.path.isfile(src):
                    continue
                try:
                    pic = Image.open(src).convert("RGB")
                    pic.thumbnail((W, H))
                    x = max(0, (W - pic.size[0]) // 2)
                    y = max(0, (H - pic.size[1]) // 2)
                    canvas.paste(pic, (x, y))
                    pasted = True
                    break
                except Exception:
                    continue
            if not pasted:
                draw = ImageDraw.Draw(canvas)
                font = ImageFont.load_default()
                y = 40
                for line in (page.get("texts") or ["课件页 %d" % page["index"]])[:12]:
                    draw.text((40, y), line, fill=(30, 30, 30), font=font)
                    y += 28
            canvas.save(target, "PNG")
        elif not os.path.isfile(target):
            with open(target, "wb") as fh:
                fh.write(
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
                    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
                )
        page["slide"] = name
        page["images"] = [name]


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
                key = "%d-%s" % (index, safe)
                if key in used:
                    continue
                used[key] = True
                if src in zf.namelist():
                    target = os.path.join(media_dir, key)
                    with zf.open(src) as src_fh, open(target, "wb") as dest_fh:
                        shutil.copyfileobj(src_fh, dest_fh)
                    images.append(key)
            pages.append({"index": index, "texts": texts_of(xml), "images": images, "slide": ""})
    if not render_soffice(pptx_path, media_dir, len(pages)):
        render_fallback(pages, media_dir)
    else:
        for page in pages:
            name = "slide-%d.png" % page["index"]
            page["slide"] = name
            page["images"] = [name]
    missing = [page for page in pages if not os.path.isfile(os.path.join(media_dir, page["slide"]))]
    if missing:
        render_fallback(pages, media_dir)
    with open(os.path.join(out_dir, "pages.json"), "w", encoding="utf-8") as fh:
        json.dump({"pages": pages}, fh, ensure_ascii=False)
    print(json.dumps({"ok": True, "pages": len(pages)}))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: read-pptx.py infile.pptx outdir")
    extract(sys.argv[1], sys.argv[2])
