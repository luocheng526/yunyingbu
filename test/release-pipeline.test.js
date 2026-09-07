import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { packArtifact } from "../src/modules/releases/pipeline/artifact.js";
import { PRODUCTION_BRANCH, RELEASE_PROFILE, STATES } from "../src/modules/releases/pipeline/constants.js";
import { signBody } from "../src/modules/releases/pipeline/hmac.js";
import { candidateIdFromKey, candidateKey, makeReleaseId } from "../src/modules/releases/pipeline/ids.js";
import { assertTransition } from "../src/modules/releases/pipeline/machine.js";
import { createPipelineStore } from "../src/modules/releases/pipeline/store.js";
import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME } from "../src/modules/profile/auth.js";

const WEBHOOK_SECRET = "test-hmac-secret";

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-"));
  fs.mkdirSync(path.join(root, "public"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "public", "a.txt"), "hello\n");
  fs.writeFileSync(path.join(root, "src", "b.js"), "export const n = 1;\n");
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"mengkai","version":"0.1.0"}\n');
  fs.writeFileSync(path.join(root, "package-lock.json"), '{"lockfileVersion":3,"name":"mengkai"}\n');
  return root;
}

function identity(extra = {}) {
  const mergeSha = extra.mergeSha || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const sourceSha = extra.sourceSha || "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const runId = extra.runId || 1001;
  const attempt = extra.attempt || 1;
  const version = extra.version || "0.1.0";
  const prNumber = extra.prNumber || 4;
  const repository = extra.repository || "luocheng526/yunyingbu";
  return {
    releaseId: makeReleaseId({
      profile: RELEASE_PROFILE,
      version,
      mergeSha,
      runId,
      attempt
    }),
    profile: RELEASE_PROFILE,
    version,
    repository,
    branch: PRODUCTION_BRANCH,
    prNumber,
    sourceSha,
    mergeSha,
    treeSha: extra.treeSha || mergeSha,
    ciWorkflow: ".github/workflows/release-build.yml",
    ciRunId: runId,
    ciRunAttempt: attempt
  };
}

function githubFrom(id) {
  return {
    event: "push",
    headBranch: PRODUCTION_BRANCH,
    conclusion: "success",
    status: "completed",
    repository: id.repository,
    prNumber: id.prNumber,
    sourceSha: id.sourceSha,
    mergeSha: id.mergeSha,
    treeSha: id.treeSha,
    runId: id.ciRunId,
    runAttempt: id.ciRunAttempt,
    workflow: id.ciWorkflow
  };
}

async function withServer(options, fn) {
  const server = http.createServer(
    createApp({
      getUser: () => ({ username: "罗成" }),
      webhookSecret: WEBHOOK_SECRET,
      pipelineStore: createPipelineStore(),
      releaseMode: "shadow",
      restart() {},
      async push() {
        return { stdout: "test-push" };
      },
      ...options
    })
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD })
  });
  const cookie = (login.headers.getSetCookie?.() || []).map((part) => part.split(";")[0]).join("; ");
  try {
    await fn(base, cookie);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function json(base, cookie, pathname, options = {}) {
  const res = await fetch(`${base}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(options.headers || {})
    },
    body: options.body
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

test("release-wake posts HMAC and never deploys", () => {
  const source = fs.readFileSync(
    new URL("../.github/workflows/release-wake.yml", import.meta.url),
    "utf8"
  );
  assert.match(source, /urllib\.request\.Request/);
  assert.match(source, /X-Hub-Signature-256/);
  assert.match(source, /This job never deploys|this job never deploys/);
  assert.doesNotMatch(source, /wake would POST to controller/);
});

test("illegal state jumps are rejected", () => {
  assert.throws(() => assertTransition(STATES.pending_approval, STATES.succeeded), /非法状态跳转/);
  assert.doesNotThrow(() => assertTransition(STATES.pending_approval, STATES.approved));
});

test("rerun attempt yields a new release_id", () => {
  const a = makeReleaseId({ profile: "mengkai", version: "0.1.0", mergeSha: "abc123def456", runId: 9, attempt: 1 });
  const b = makeReleaseId({ profile: "mengkai", version: "0.1.0", mergeSha: "abc123def456", runId: 9, attempt: 2 });
  assert.notEqual(a, b);
  assert.match(a, /^mengkai-v0\.1\.0-abc123def456-run9-1$/);
});

test("deterministic pack is stable across two runs", () => {
  const src = makeFixture();
  const id = identity();
  const out1 = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  const first = packArtifact({ sourceRoot: src, outDir: out1, identity: id });
  const second = packArtifact({ sourceRoot: src, outDir: out2, identity: id });
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("tampered archive fails verify", async () => {
  const { verifyArtifactDir } = await import("../src/modules/releases/pipeline/artifact.js");
  const src = makeFixture();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  packArtifact({ sourceRoot: src, outDir: out, identity: identity() });
  fs.appendFileSync(path.join(out, "artifact.tar.gz"), "tamper");
  assert.throws(() => verifyArtifactDir(out), /哈希|不一致/);
});

test("PR tip / non-main ingest is rejected; verified ingest becomes pending_approval", async () => {
  const src = makeFixture();
  const id = identity();
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  packArtifact({ sourceRoot: src, outDir: artifactDir, identity: id });
  await withServer({}, async (base, cookie) => {
    const tip = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({
        artifactDir,
        github: { ...githubFrom(id), event: "pull_request", headBranch: "cursor/releases-center-0623" }
      })
    });
    assert.equal(tip.res.status, 400);
    assert.match(tip.body.error, /生产主支 push/);

    const ok = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({ artifactDir, github: githubFrom(id) })
    });
    assert.equal(ok.res.status, 201);
    assert.equal(ok.body.item.state, "pending_approval");
    assert.equal(ok.body.item.overlay, false);
    assert.equal(ok.body.item.can_approve, false);
    assert.match(ok.body.item.block_reason, /shadow/);
    const expectedId = candidateIdFromKey(
      candidateKey({
        repository: id.repository,
        prNumber: id.prNumber,
        sourceSha: id.sourceSha,
        releaseId: id.releaseId
      })
    );
    assert.equal(ok.body.item.id, expectedId);

    const approve = await json(base, cookie, `/api/releases/candidates/${ok.body.item.id}/approve`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(approve.res.status, 409);

    const forced = await json(base, cookie, `/api/releases/candidates/${ok.body.item.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ force: true, sha: id.mergeSha })
    });
    assert.equal(forced.res.status, 400);

    const shadow = await json(base, cookie, "/api/releases/shadow-install", {
      method: "POST",
      body: JSON.stringify({ candidate_id: ok.body.item.id })
    });
    assert.equal(shadow.res.status, 200);
    assert.equal(shadow.body.shadow.deployOutbox, false);
    assert.equal(fs.existsSync(path.join(shadow.body.shadow.dest, "public", "a.txt")), true);

    const ready = await json(base, cookie, "/api/releases/readyz");
    assert.equal(ready.body.deployment_ready, false);
    assert.equal(ready.body.outbox, 0);
    assert.equal(ready.body.version, "0.1.0");
  });
});

test("duplicate webhook is idempotent; production mode approve queues outbox", async () => {
  const payload = JSON.stringify({
    action: "completed",
    repository: { full_name: "luocheng526/yunyingbu" },
    workflow_run: {
      id: 77,
      run_attempt: 1,
      name: "Release artifact",
      event: "push",
      head_branch: "main",
      status: "completed",
      conclusion: "success"
    }
  });
  await withServer({}, async (base) => {
    const headers = {
      "Content-Type": "application/json",
      "X-GitHub-Event": "workflow_run",
      "X-GitHub-Delivery": "del-1",
      "X-Hub-Signature-256": signBody(WEBHOOK_SECRET, payload)
    };
    const first = await fetch(`${base}/api/releases/webhooks/github`, { method: "POST", headers, body: payload });
    const second = await fetch(`${base}/api/releases/webhooks/github`, { method: "POST", headers, body: payload });
    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    const dup = await second.json();
    assert.equal(dup.duplicate, true);
    const unsigned = await fetch(`${base}/api/releases/webhooks/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    assert.equal(unsigned.status, 401);
  });

  await withServer({}, async (base, cookie) => {
    const overlayPayload = JSON.stringify({
      action: "completed",
      repository: { full_name: "luocheng526/yunyingbu" },
      workflow_run: {
        id: 88,
        run_attempt: 1,
        name: "Release artifact",
        event: "push",
        head_branch: "main",
        head_sha: "cccccccccccccccccccccccccccccccccccccccc",
        status: "completed",
        conclusion: "success",
        pull_requests: [{ number: 4 }]
      }
    });
    const overlayHeaders = {
      "Content-Type": "application/json",
      "X-GitHub-Event": "workflow_run",
      "X-GitHub-Delivery": "del-overlay",
      "X-Hub-Signature-256": signBody(WEBHOOK_SECRET, overlayPayload)
    };
    const woke = await fetch(`${base}/api/releases/webhooks/github`, {
      method: "POST",
      headers: overlayHeaders,
      body: overlayPayload
    });
    assert.equal(woke.status, 202);
    const wokeBody = await woke.json();
    assert.equal(wokeBody.overlay, true);
    assert.equal(wokeBody.state, "waiting_ci");
    const listed = await json(base, cookie, "/api/releases/candidates");
    assert.equal(listed.body.items.length, 1);
    assert.equal(listed.body.items[0].overlay, true);
    assert.equal(listed.body.items[0].can_approve, false);
    assert.equal(listed.body.items[0].state, "waiting_ci");
    const blocked = await json(base, cookie, `/api/releases/candidates/${listed.body.items[0].id}/approve`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(blocked.res.status, 409);

    const srcOverlay = makeFixture();
    const overlayId = identity({ runId: 88, mergeSha: "cccccccccccccccccccccccccccccccccccccccc" });
    const overlayDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
    packArtifact({ sourceRoot: srcOverlay, outDir: overlayDir, identity: overlayId });
    const ingested = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({ artifactDir: overlayDir, github: githubFrom(overlayId) })
    });
    assert.equal(ingested.res.status, 201);
    assert.equal(ingested.body.item.overlay, false);
    const after = await json(base, cookie, "/api/releases/candidates");
    assert.equal(after.body.items.some((row) => row.overlay), false);
    assert.equal(after.body.items.some((row) => row.id === ingested.body.item.id), true);
  });


  const src = makeFixture();
  const id = identity({ runId: 2002 });
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  packArtifact({ sourceRoot: src, outDir: artifactDir, identity: id });
  await withServer({ releaseMode: "production", allowLocalIngress: true }, async (base, cookie) => {
    const created = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({ artifactDir, github: githubFrom(id) })
    });
    assert.equal(created.body.item.can_approve, true);
    const approved = await json(base, cookie, `/api/releases/candidates/${created.body.item.id}/approve`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(approved.res.status, 200);
    assert.equal(approved.body.item.state, "deploy_queued");
  });
});

test("newer merge SHA supersedes the previous pending candidate", async () => {
  const src = makeFixture();
  const older = identity({ mergeSha: "1111111111111111111111111111111111111111", runId: 1 });
  const newer = identity({ mergeSha: "2222222222222222222222222222222222222222", runId: 2 });
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  packArtifact({ sourceRoot: src, outDir: dirA, identity: older });
  packArtifact({ sourceRoot: src, outDir: dirB, identity: newer });
  await withServer({}, async (base, cookie) => {
    const a = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({ artifactDir: dirA, github: githubFrom(older) })
    });
    const b = await json(base, cookie, "/api/releases/ingress/local", {
      method: "POST",
      body: JSON.stringify({ artifactDir: dirB, github: githubFrom(newer) })
    });
    assert.equal(b.res.status, 201);
    const listed = await json(base, cookie, "/api/releases/candidates");
    const old = listed.body.items.find((row) => row.id === a.body.item.id);
    const fresh = listed.body.items.find((row) => row.id === b.body.item.id);
    assert.equal(old.state, "superseded");
    assert.equal(fresh.state, "pending_approval");
  });
});

test("wake with fetchReleaseArtifact ingests the triple and drops overlay", async () => {
  const src = makeFixture();
  const id = identity({
    runId: 91,
    mergeSha: "dddddddddddddddddddddddddddddddddddddddd",
    sourceSha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  });
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-out-"));
  packArtifact({ sourceRoot: src, outDir: artifactDir, identity: id });
  const payload = JSON.stringify({
    action: "completed",
    repository: { full_name: id.repository },
    workflow_run: {
      id: id.ciRunId,
      run_attempt: id.ciRunAttempt,
      name: "Release artifact",
      event: "push",
      head_branch: "main",
      head_sha: id.mergeSha,
      status: "completed",
      conclusion: "success",
      pull_requests: [{ number: id.prNumber }]
    }
  });
  await withServer(
    {
      fetchReleaseArtifact: async () => artifactDir
    },
    async (base, cookie) => {
      const woke = await fetch(`${base}/api/releases/webhooks/github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": "workflow_run",
          "X-GitHub-Delivery": "del-fetch",
          "X-Hub-Signature-256": signBody(WEBHOOK_SECRET, payload)
        },
        body: payload
      });
      assert.equal(woke.status, 202);
      const body = await woke.json();
      assert.equal(body.ingested, true);
      assert.equal(body.overlay, false);
      assert.equal(body.item.state, "pending_approval");
      const listed = await json(base, cookie, "/api/releases/candidates");
      assert.equal(listed.body.items.some((row) => row.overlay), false);
      assert.equal(listed.body.items[0].can_approve, false);
    }
  );
});

test("pipeline store survives a new process via persistPath", () => {
  const persistPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rel-persist-")), "pipeline.json");
  const first = createPipelineStore({ persistPath });
  first.recordDelivery({ deliveryId: "d1", runId: 1 });
  first.insertCandidate({
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    overlay: true,
    state: "waiting_ci",
    ciRunId: 1,
    ciRunAttempt: 1
  });
  const second = createPipelineStore({ persistPath });
  assert.equal(second.list().length, 1);
  assert.equal(second.findDelivery("d1").runId, 1);
});
