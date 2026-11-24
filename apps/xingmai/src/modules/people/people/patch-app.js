const IMPORT_LINE = 'import { peopleRouter } from "./modules/people/router.js";';
const USE_LINE = 'app.use("/api/people", peopleRouter);';

/** Only insert the people API mount. Does not rewrite other app.use() calls. */
export function patchAppSource(source) {
  if (source.includes("./modules/people/router.js") && source.includes(USE_LINE)) {
    return source;
  }

  let next = source;
  if (!next.includes("./modules/people/router.js")) {
    const importMatches = [...next.matchAll(/^import .+$/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = last.index + last[0].length;
      next = `${next.slice(0, insertAt)}\n${IMPORT_LINE}${next.slice(insertAt)}`;
    } else {
      next = `${IMPORT_LINE}\n${next}`;
    }
  }

  if (!next.includes(USE_LINE)) {
    if (!/return app;/.test(next)) {
      throw new Error("src/app.js 中找不到 return app; ，无法安全增加人员 API");
    }
    next = next.replace(/return app;/, `${USE_LINE}\n  return app;`);
  }

  return next;
}
