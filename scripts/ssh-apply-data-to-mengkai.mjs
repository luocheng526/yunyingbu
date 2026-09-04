#!/usr/bin/env node
/**
 * Copy the data-center overlay onto a remote /opt/mengkai over SSH.
 * Never restarts production. Does not touch other module trees.
 *
 * Env:
 *   ALIYUN_SSH_PRIVATE_KEY  PEM (preferred)
 *   ALIYUN_SSH_KEY_FILE     path to private key (default ~/.ssh/yunyingbu_aliyun)
 *   ALIYUN_SSH_USER         default root
 *   ALIYUN_SSH_HOST         default 8.140.33.133
 *   MENGKAI_DIR             remote target, default /opt/mengkai
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const user = process.env.ALIYUN_SSH_USER || "root";
const host = process.env.ALIYUN_SSH_HOST || "8.140.33.133";
const remoteMengkai = process.env.MENGKAI_DIR || "/opt/mengkai";
const defaultKeyFile = path.join(os.homedir(), ".ssh", "yunyingbu_aliyun");

function loadPrivateKey() {
  const fromEnv = process.env.ALIYUN_SSH_PRIVATE_KEY;
  if (fromEnv && fromEnv.includes("PRIVATE KEY")) {
    return fromEnv;
  }
  const keyFile = process.env.ALIYUN_SSH_KEY_FILE || defaultKeyFile;
  if (fs.existsSync(keyFile)) {
    const body = fs.readFileSync(keyFile, "utf8");
    if (body.includes("PRIVATE KEY")) {
      return body;
    }
  }
  console.error(
    "ALIYUN_SSH_PRIVATE_KEY is missing; cannot stage overlay on ECS. Also checked ALIYUN_SSH_KEY_FILE / ~/.ssh/yunyingbu_aliyun."
  );
  process.exit(2);
}

const keyBody = loadPrivateKey();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "data-ssh-"));
const keyPath = path.join(tmp, "id");
fs.writeFileSync(keyPath, keyBody.endsWith("\n") ? keyBody : `${keyBody}\n`, { mode: 0o600 });

const sshBase = [
  "ssh",
  "-i",
  keyPath,
  "-o",
  "BatchMode=yes",
  "-o",
  "IdentitiesOnly=yes",
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ConnectTimeout=12"
];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim() || `${cmd} exited ${result.status}`;
    throw new Error(err);
  }
  return result;
}

const staging = "/tmp/data-center-overlay";
const files = [
  "public/data.html",
  "src/modules/data/overview.js",
  "src/modules/data/router.js",
  "src/modules/data/patch-app.js",
  "scripts/apply-data-to-mengkai.mjs"
];

const tarList = path.join(tmp, "files.txt");
fs.writeFileSync(tarList, `${files.join("\n")}\n`);

try {
  run("tar", ["-czf", path.join(tmp, "overlay.tgz"), "-T", tarList], { cwd: repoRoot });
  run(sshBase[0], [...sshBase.slice(1), `${user}@${host}`, `rm -rf ${staging} && mkdir -p ${staging}`]);
  const scp = spawnSync(
    "scp",
    ["-i", keyPath, "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new", path.join(tmp, "overlay.tgz"), `${user}@${host}:${staging}/overlay.tgz`],
    { encoding: "utf8" }
  );
  if (scp.status !== 0) {
    throw new Error((scp.stderr || scp.stdout || "scp failed").trim());
  }
  const remote = [
    `set -e`,
    `tar -xzf ${staging}/overlay.tgz -C ${staging}`,
    `test -d ${remoteMengkai}`,
    `MENGKAI_DIR=${remoteMengkai} node ${staging}/scripts/apply-data-to-mengkai.mjs`,
    `test -f ${remoteMengkai}/public/data.html`,
    `test -f ${remoteMengkai}/src/modules/data/router.js`,
    `grep -q '/api/data' ${remoteMengkai}/src/app.js`
  ].join(" && ");
  const applied = run(sshBase[0], [...sshBase.slice(1), `${user}@${host}`, remote]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        host,
        mengkai: remoteMengkai,
        restarted: false,
        stdout: (applied.stdout || "").trim()
      },
      null,
      2
    )
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
