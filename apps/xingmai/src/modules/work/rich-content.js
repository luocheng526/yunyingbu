const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]);

function isImage(file) {
  if (!IMAGE_TYPES.has(file?.mime)) return false;
  const b = file.bytes;
  if (!Buffer.isBuffer(b)) return false;
  if (file.mime === "image/png") return b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mime === "image/jpeg") return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (file.mime === "image/gif") return /^GIF8[79]a$/.test(b.subarray(0, 6).toString());
  if (file.mime === "image/webp") return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP";
  return b.subarray(0, 2).toString() === "BM";
}

// Only text and references to this request's uploaded images are persisted. Never accept HTML or URLs.
export function parseRichContent(raw, files, maxText) {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 24000) throw new Error("图文内容格式不正确");
  let nodes;
  try { nodes = JSON.parse(raw); } catch { throw new Error("图文内容格式不正确"); }
  if (!Array.isArray(nodes) || nodes.length > 256) throw new Error("图文内容过于复杂，请精简后重试");
  let textLength = 0;
  const result = [];
  for (const node of nodes) {
    if (node?.type === "text" && typeof node.text === "string") {
      textLength += node.text.length;
      if (textLength > maxText) throw new Error(`文字最多 ${maxText} 字，请精简后重试`);
      if (!node.text) continue;
      if (result.at(-1)?.type === "text") result.at(-1).text += node.text;
      else result.push({ type: "text", text: node.text });
    } else if (node?.type === "image" && Number.isInteger(node.upload) && node.upload >= 0 && isImage(files[node.upload])) {
      result.push({ type: "image", upload: node.upload });
    } else {
      throw new Error("正文图片无效，请移除后重新粘贴（支持 PNG、JPG、GIF、WebP、BMP）");
    }
  }
  if (result.filter(node => node.type === "image").length > 3) throw new Error("正文图片最多 3 张");
  return result;
}

export function bindRichFiles(nodes, files) {
  return nodes && nodes.map(node => node.type === "image" ? { type: "image", fileId: files[node.upload].id } : node);
}

export function richPlainText(nodes, fallback) {
  return nodes ? nodes.filter(node => node.type === "text").map(node => node.text).join("") : fallback;
}
