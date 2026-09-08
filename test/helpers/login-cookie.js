import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME } from "../../src/modules/profile/auth.js";

export async function loginCookie(base) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD })
  });
  return (res.headers.getSetCookie?.() || []).map((part) => part.split(";")[0]).join("; ");
}
