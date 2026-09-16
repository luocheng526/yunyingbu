import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = readFileSync(join(root, "src/modules/home/pages.js"), "utf8");
const middleware = readFileSync(join(root, "src/modules/profile/middleware.js"), "utf8");
const nav = readFileSync(join(root, "public/shared/nav.js"), "utf8");
const layout = readFileSync(join(root, "public/shared/layout.css"), "utf8");

test("shell pair shares 0.1.625 and does not import currentUserAsync", () => {
  assert.match(pages, /xm-fast-shell 0\.1\.625/);
  assert.match(middleware, /xm-fast-shell 0\.1\.625/);
  assert.match(middleware, /export const SHELL_ASSET_VER = "0\.1\.625"/);
  assert.match(middleware, /import \{ currentUser, publicProfile \} from "\.\/auth\.js"/);
  assert.doesNotMatch(middleware, /currentUserAsync/);
  assert.match(nav, /xm-fast-shell 0\.1\.625/);
  assert.match(nav, /const ASSET_VER = "0\.1\.625"/);
  assert.match(layout, /xm-sider-narrow 0\.1\.625/);
});

test("shell HTML pins module scripts so data.js cache-busts with the shell", () => {
  assert.match(
    middleware,
    /\/shared\/modules\/\$\{id\}\.js\?v=\$\{SHELL_ASSET_VER\}/
  );
  assert.match(
    middleware,
    /\/shared\/modules\/\$1\.js\?v=\$\{SHELL_ASSET_VER\}/
  );
  assert.match(nav, /src \+ "\?v=" \+ ASSET_VER/);
});

test("stores route stays on the stores module, not data.js", () => {
  assert.match(middleware, /"\/stores": "stores"/);
  assert.match(middleware, /"\/stores": "店铺维护中心"/);
  assert.match(nav, /"\/stores": "stores"/);
});

test("renderAppShell template pins nav, layout, and the route module", () => {
  assert.match(middleware, /\/shared\/nav\.js\?v=\$\{SHELL_ASSET_VER\}/);
  assert.match(middleware, /\/shared\/layout\.css\?v=\$\{SHELL_ASSET_VER\}/);
  assert.match(
    middleware,
    /<link rel="preload" href="\/shared\/modules\/\$\{id\}\.js\?v=\$\{SHELL_ASSET_VER\}" as="script" \/>/
  );
  assert.match(
    middleware,
    /<script src="\/shared\/modules\/\$\{id\}\.js\?v=\$\{SHELL_ASSET_VER\}" defer data-xm-mod="\$\{key\}"><\/script>/
  );
});
