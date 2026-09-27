const PROFILE_IMPORT = 'import { attachProfile } from "./modules/profile/attach.js";';
const ATTACH_CALL = "attachProfile(app);";

function insertImport(source, line) {
  if (source.includes("./modules/profile/attach.js")) {
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
  if (next.includes(ATTACH_CALL)) {
    return next;
  }
  if (next.includes("app.use(express.json());")) {
    return next.replace("app.use(express.json());", `app.use(express.json());\n  ${ATTACH_CALL}`);
  }
  throw new Error("src/app.js 中找不到 express.json() ，无法安全挂载个人中心");
}
