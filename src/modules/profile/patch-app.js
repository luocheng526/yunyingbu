const PROFILE_IMPORT = 'import { profileRouter } from "./modules/profile/profile-router.js";';
const PROFILE_USE = 'app.use("/api/profile", profileRouter);';

function insertImport(source, line) {
  if (source.includes(line) || source.includes("./modules/profile/profile-router.js")) {
    return source;
  }
  const importMatches = [...source.matchAll(/^import .+$/gm)];
  if (importMatches.length > 0) {
    const last = importMatches[importMatches.length - 1];
    const insertAt = last.index + last[0].length;
    return `${source.slice(0, insertAt)}\n${line}${source.slice(insertAt)}`;
  }
  return `${line}\n${source}`;
}

export function patchAppSource(source) {
  let next = insertImport(source, PROFILE_IMPORT);
  if (next.includes(PROFILE_USE)) {
    return next;
  }
  if (!/return app;/.test(next)) {
    throw new Error("src/app.js 中找不到 return app; ，无法安全增加个人中心路由");
  }
  return next.replace(/return app;/, `${PROFILE_USE}\n  return app;`);
}
