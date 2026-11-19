const IMPORT_LINE = 'import { attachHome } from "./modules/home/attach.js";';
const ATTACH_CALL = "attachHome(app);";

export function patchAppSource(source) {
  if (source.includes("./modules/home/attach.js") && source.includes(ATTACH_CALL)) {
    return source;
  }

  let next = source;
  if (!next.includes("./modules/home/attach.js")) {
    const importMatches = [...next.matchAll(/^import .+$/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = last.index + last[0].length;
      next = `${next.slice(0, insertAt)}\n${IMPORT_LINE}${next.slice(insertAt)}`;
    } else {
      next = `${IMPORT_LINE}\n${next}`;
    }
  }

  if (!next.includes(ATTACH_CALL)) {
    if (!/return app;/.test(next)) {
      throw new Error("src/app.js 中找不到 return app; ，无法安全增加首页路由");
    }
    next = next.replace(/return app;/, `${ATTACH_CALL}\n  return app;`);
  }

  return next;
}
