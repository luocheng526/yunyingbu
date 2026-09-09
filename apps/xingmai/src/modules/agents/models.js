const DESK_ID = "desk";

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : String(value);
}

function configuredRemote() {
  const id = env("XM_AGENTS_MODEL_ID", "configured").trim() || "configured";
  if (id === DESK_ID) {
    return null;
  }
  const key = env("XM_AGENTS_API_KEY");
  return {
    id,
    label: env("XM_AGENTS_MODEL_LABEL", "服务端配置模型"),
    available: Boolean(key),
    note: key ? "只复述本站工具结果，不编造" : "服务端未配置密钥，不可用",
    key,
    base: env("XM_AGENTS_API_BASE")
  };
}

function allModels() {
  const remote = configuredRemote();
  const list = [
    {
      id: DESK_ID,
      label: "主脑问答台（本站只读）",
      available: true,
      note: "答案只来自人员花名册只读接口",
      key: "",
      base: ""
    }
  ];
  if (remote) {
    list.push(remote);
  }
  return list;
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
  const wanted = String(modelId || "").trim() || DESK_ID;
  const found = allModels().find((item) => item.id === wanted);
  if (!found) {
    const error = new Error("模型不存在");
    error.statusCode = 400;
    throw error;
  }
  if (!found.available) {
    const error = new Error("模型未配置密钥，请改选主脑问答台");
    error.statusCode = 400;
    throw error;
  }
  return found;
}

export function defaultModelId() {
  return DESK_ID;
}

export function stripSecrets(model) {
  if (!model) {
    return null;
  }
  return { id: model.id, label: model.label, available: model.available, note: model.note };
}

export { DESK_ID };
