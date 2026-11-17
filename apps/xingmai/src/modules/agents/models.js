export const DESK_ID = "desk";

const DEFAULT_REMOTE = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4o", label: "GPT-4o" }
];

let runtime = { key: "", base: "", extras: [] };

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : String(value);
}

export function parseModelList(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: String(item.id || "").trim(),
          label: String(item.label || item.id || "").trim()
        }))
        .filter((item) => item.id && item.id !== DESK_ID);
    }
  } catch {
    /* id:label,id:label */
  }
  return text
    .split(",")
    .map((part) => {
      const [id, ...rest] = part.split(":");
      return { id: String(id || "").trim(), label: rest.join(":").trim() || String(id || "").trim() };
    })
    .filter((item) => item.id && item.id !== DESK_ID);
}

export function setRuntimeRemote(next = {}) {
  runtime = {
    key: String(next.key || ""),
    base: String(next.base || "").replace(/\/+$/, ""),
    extras: Array.isArray(next.extras) ? next.extras.filter((item) => item && item.id) : []
  };
}

function apiKey() {
  return env("XM_AGENTS_API_KEY") || env("OPENAI_API_KEY") || runtime.key;
}

function apiBase() {
  const raw = env("XM_AGENTS_API_BASE") || runtime.base || (apiKey() ? "https://api.openai.com/v1" : "");
  return raw.replace(/\/+$/, "");
}

function parseExtraModels() {
  const fromEnv = parseModelList(env("XM_AGENTS_MODELS"));
  return fromEnv.length ? fromEnv : runtime.extras;
}

export function remoteStatus() {
  const fromEnv = Boolean(env("XM_AGENTS_API_KEY") || env("OPENAI_API_KEY"));
  return {
    configured: Boolean(apiKey()),
    source: fromEnv ? "env" : runtime.key ? "saved" : "",
    apiBase: apiBase(),
    locked: fromEnv
  };
}

function remoteCatalog() {
  const extra = parseExtraModels();
  const forced = env("XM_AGENTS_MODEL_ID").trim();
  const forcedLabel = env("XM_AGENTS_MODEL_LABEL", "服务端配置模型");
  const list = extra.length ? extra : DEFAULT_REMOTE.map((item) => ({ ...item }));
  if (forced && forced !== DESK_ID && !list.some((item) => item.id === forced)) {
    list.unshift({ id: forced, label: forcedLabel });
  }
  return list;
}

function allModels() {
  const key = apiKey();
  const base = apiBase();
  const ready = Boolean(key && base);
  const desk = {
    id: DESK_ID,
    label: "主脑问答台（本站只读）",
    available: true,
    note: "花名册只读 + 通用选品/做店方法",
    key: "",
    base: ""
  };
  const remotes = remoteCatalog().map((item) => ({
    id: item.id,
    label: item.label,
    available: ready,
    note: ready ? "后台模型，密钥不出前端" : "后台未配置密钥",
    key,
    base
  }));
  return [desk, ...remotes];
}

export function publicModels() {
  return allModels().map((item) => ({
    id: item.id,
    label: item.label,
    available: item.available,
    note: item.note
  }));
}

export function resolveModel(modelId) {
  const wanted = String(modelId || "").trim() || defaultModelId();
  const found = allModels().find((item) => item.id === wanted);
  if (!found) {
    const error = new Error("模型不存在");
    error.statusCode = 400;
    throw error;
  }
  if (!found.available) {
    const error = new Error("该模型后台未配置密钥，请在本页接入，或改选主脑问答台");
    error.statusCode = 400;
    throw error;
  }
  return found;
}

export function defaultModelId() {
  const remote = allModels().find((item) => item.id !== DESK_ID && item.available);
  return remote ? remote.id : DESK_ID;
}

export function stripSecrets(model) {
  if (!model) {
    return null;
  }
  return { id: model.id, label: model.label, available: model.available, note: model.note };
}

export function canCallRemote(model) {
  return Boolean(model && model.id !== DESK_ID && model.key && model.base);
}
