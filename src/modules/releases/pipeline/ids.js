import { createHash } from "node:crypto";

const UUID_NS = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

export function uuidFromKey(key) {
  const hash = createHash("sha1").update(UUID_NS).update(String(key)).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function shortSha(sha) {
  return String(sha || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 12).toLowerCase();
}

export function makeReleaseId({ profile, version, mergeSha, runId, attempt }) {
  return `${profile}-v${version}-${shortSha(mergeSha)}-run${runId}-${attempt}`;
}

export function candidateKey({ repository, prNumber, sourceSha, releaseId }) {
  return `${repository}|${prNumber}|${sourceSha}|${releaseId}`;
}

export function candidateIdFromKey(key) {
  return uuidFromKey(key);
}
