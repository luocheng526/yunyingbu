import { createHmac, timingSafeEqual } from "node:crypto";

export function signBody(secret, raw) {
  const digest = createHmac("sha256", String(secret)).update(raw).digest("hex");
  return `sha256=${digest}`;
}

export function verifySignature(secret, raw, header) {
  const expected = signBody(secret, raw);
  const got = String(header || "");
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
