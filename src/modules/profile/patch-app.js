const AUTH_IMPORT = 'import { authRouter } from "./modules/profile/auth-router.js";';
const PROFILE_IMPORT = 'import { profileRouter } from "./modules/profile/profile-router.js";';
const GATE_IMPORT = 'import { requireLoginUnlessPublic } from "./modules/profile/gate.js";';
const GATE_USE = "app.use(requireLoginUnlessPublic);";
const AUTH_USE = 'app.use("/api/auth", authRouter);';
const PROFILE_USE = 'app.use("/api/profile", profileRouter);';
const LOGIN_GET = `app.get("/login", (_req, res) => {
    res.sendFile(path.join(publicDir, "login.html"));
  });`;

function insertImport(source, line) {
  if (source.includes(line)) {
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

function insertUse(source, line) {
  if (source.includes(line)) {
    return source;
  }
  if (!/return app;/.test(source)) {
    throw new Error("src/app.js 中找不到 return app; ，无法安全增加个人中心路由");
  }
  return source.replace(/return app;/, `${line}\n  return app;`);
}

export function patchAppSource(source) {
  let next = source;
  next = insertImport(next, AUTH_IMPORT);
  next = insertImport(next, PROFILE_IMPORT);
  next = insertImport(next, GATE_IMPORT);
  if (!next.includes(GATE_USE) && next.includes("const app = express();")) {
    next = next.replace("const app = express();", `const app = express();\n  ${GATE_USE}`);
  }
  next = insertUse(next, LOGIN_GET);
  next = insertUse(next, AUTH_USE);
  next = insertUse(next, PROFILE_USE);
  return next;
}
