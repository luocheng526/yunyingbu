export function isRawUpload(req) {
  const ctype = String(req.headers["content-type"] || "").toLowerCase();
  return (
    ctype.includes("application/octet-stream") ||
    ctype.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation")
  );
}

export function readRawBody(req, { maxBytes = 25 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) {
        return;
      }
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        const error = new Error("文件太大，最多 25MB");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      if (!failed) {
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", reject);
  });
}

export function parseMultipart(req, { maxBytes = 25 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const ctype = String(req.headers["content-type"] || "");
    const match = ctype.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) {
      const error = new Error("请用表单上传文件");
      error.statusCode = 400;
      reject(error);
      return;
    }
    const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) {
        return;
      }
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        const error = new Error("文件太大，最多 25MB");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) {
        return;
      }
      try {
        resolve(splitParts(Buffer.concat(chunks), boundary));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function splitParts(buf, boundary) {
  const fields = {};
  let file = null;
  let start = indexOf(buf, boundary, 0);
  while (start !== -1) {
    const after = start + boundary.length;
    if (buf[after] === 45 && buf[after + 1] === 45) {
      break;
    }
    const headStart = after + (buf[after] === 13 ? 2 : 0);
    const sep = indexOf(buf, Buffer.from("\r\n\r\n"), headStart);
    if (sep === -1) {
      break;
    }
    const next = indexOf(buf, boundary, sep + 4);
    if (next === -1) {
      break;
    }
    const header = buf.slice(headStart, sep).toString("utf8");
    let bodyEnd = next;
    if (buf[bodyEnd - 2] === 13 && buf[bodyEnd - 1] === 10) {
      bodyEnd -= 2;
    }
    const body = buf.slice(sep + 4, bodyEnd);
    const nameHit = header.match(/name="([^"]+)"/i);
    const fileHit = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\r\n]+)|filename="([^"]*)"/i);
    const name = nameHit ? nameHit[1] : "";
    let filename = "";
    if (fileHit) {
      try {
        filename = fileHit[1] ? decodeURIComponent(fileHit[1].trim()) : fileHit[2] || "";
      } catch {
        filename = fileHit[2] || fileHit[1] || "";
      }
    }
    if (filename) {
      file = {
        field: name,
        filename,
        type: (header.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || "",
        buffer: body
      };
    } else if (name) {
      fields[name] = body.toString("utf8");
    }
    start = next;
  }
  return { fields, file };
}

function indexOf(buf, needle, from) {
  return buf.indexOf(needle, from);
}
