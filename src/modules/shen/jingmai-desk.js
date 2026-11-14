import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { connect as connectTcp } from "node:net";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import zlib from "node:zlib";
import { extractShopDeal, parseHomeCard, withDeadline } from "./jingmai.js";

const LOGIN_URL =
  "https://passport.shop.jd.com/login/index.action/jdm?ReturnUrl=" + encodeURIComponent("https://shop.jd.com/");
const CHROME_VERSION = "157.0.8103.78";
const CHROME_URL =
  "https://cdn.npmmirror.com/binaries/chrome-for-testing/" +
  CHROME_VERSION +
  "/linux64/chrome-headless-shell-linux64.zip";
const SESSION_NAMES = new Set(["thor", "pt_key"]);

const SYSTEM_SONAMES = new Set(["libc.so.6", "libdl.so.2", "libpthread.so.0", "libm.so.6", "libgcc_s.so.1", "ld-linux-x86-64.so.2", "linux-vdso.so.1"]);
const SONAME_PACKAGES = {
  "libatk-1.0.so.0": ["libatk1.0-0t64", "libatk1.0-0"],
  "libatk-bridge-2.0.so.0": ["libatk-bridge2.0-0t64", "libatk-bridge2.0-0"],
  "libatspi.so.0": ["libatspi2.0-0t64", "libatspi2.0-0"],
  "libasound.so.2": ["libasound2t64", "libasound2"],
  "libglib-2.0.so.0": ["libglib2.0-0t64", "libglib2.0-0"],
  "libgobject-2.0.so.0": ["libglib2.0-0t64", "libglib2.0-0"],
  "libgio-2.0.so.0": ["libglib2.0-0t64", "libglib2.0-0"],
  "libgmodule-2.0.so.0": ["libglib2.0-0t64", "libglib2.0-0"],
  "libnspr4.so": ["libnspr4"],
  "libnss3.so": ["libnss3"],
  "libnssutil3.so": ["libnss3"],
  "libplc4.so": ["libnspr4"],
  "libplds4.so": ["libnspr4"],
  "libsmime3.so": ["libnss3"],
  "libssl3.so": ["libnss3"],
  "libfreebl3.so": ["libnss3"],
  "libsoftokn3.so": ["libnss3"],
  "libdbus-1.so.3": ["libdbus-1-3"],
  "libX11.so.6": ["libx11-6"],
  "libXcomposite.so.1": ["libxcomposite1"],
  "libXdamage.so.1": ["libxdamage1"],
  "libXext.so.6": ["libxext6"],
  "libXfixes.so.3": ["libxfixes3"],
  "libXrandr.so.2": ["libxrandr2"],
  "libXrender.so.1": ["libxrender1"],
  "libXau.so.6": ["libxau6"],
  "libXdmcp.so.6": ["libxdmcp6"],
  "libXi.so.6": ["libxi6"],
  "libgbm.so.1": ["libgbm1"],
  "libexpat.so.1": ["libexpat1"],
  "libxcb.so.1": ["libxcb1"],
  "libxkbcommon.so.0": ["libxkbcommon0"],
  "libudev.so.1": ["libudev1"],
  "libdrm.so.2": ["libdrm2"],
  "libpcre2-8.so.0": ["libpcre2-8-0"],
  "libffi.so.8": ["libffi8"],
  "libz.so.1": ["zlib1g"],
  "libmount.so.1": ["libmount1"],
  "libselinux.so.1": ["libselinux1"],
  "libsystemd.so.0": ["libsystemd0"],
  "libblkid.so.1": ["libblkid1"],
  "libgcrypt.so.20": ["libgcrypt20"],
  "liblz4.so.1": ["liblz4-1"],
  "liblzma.so.5": ["liblzma5"],
  "libzstd.so.1": ["libzstd1"],
  "libbsd.so.0": ["libbsd0"],
  "libgpg-error.so.0": ["libgpg-error0"],
  "libmd.so.0": ["libmd0"],
  "libcap.so.2": ["libcap2"],
  "libpango-1.0.so.0": ["libpango-1.0-0"],
  "libpangocairo-1.0.so.0": ["libpangocairo-1.0-0"],
  "libcairo.so.2": ["libcairo2"],
  "libcups.so.2": ["libcups2t64", "libcups2"],
  "libfontconfig.so.1": ["libfontconfig1"],
  "libfreetype.so.6": ["libfreetype6"],
  "libpng16.so.16": ["libpng16-16t64", "libpng16-16"],
  "libwayland-server.so.0": ["libwayland-server0"],
  "libwayland-client.so.0": ["libwayland-client0"],
  "libwayland-cursor.so.0": ["libwayland-cursor0"],
  "libwayland-egl.so.1": ["libwayland-egl1"],
  "libgtk-3.so.0": ["libgtk-3-0t64", "libgtk-3-0"],
  "libgdk-3.so.0": ["libgtk-3-0t64", "libgtk-3-0"],
  "libpangoft2-1.0.so.0": ["libpangoft2-1.0-0"],
  "libharfbuzz.so.0": ["libharfbuzz0b"],
  "libpixman-1.so.0": ["libpixman-1-0"],
  "libxcb-shm.so.0": ["libxcb-shm0"],
  "libxcb-render.so.0": ["libxcb-render0"],
  "libxcb-dri3.so.0": ["libxcb-dri3-0"],
  "libxcb-present.so.0": ["libxcb-present0"],
  "libxcb-sync.so.1": ["libxcb-sync1"],
  "libxcb-xfixes.so.0": ["libxcb-xfixes0"],
  "libxshmfence.so.1": ["libxshmfence1"],
  "libstdc++.so.6": ["libstdc++6"]
};

let current = null;
let readerDesk = null;
let readerIdle = null;
let chromeInstall = null;
let libraryPath = "";
let libraryTask = null;
let libraryNote = "";
let packageIndex = null;

function chromeHomes() {
  return [process.env.SHEN_CHROME_DIR, "/tmp/shen-chrome", "/opt/mengkai/.shen-chrome"].filter(Boolean);
}

function installedBinary() {
  for (const home of chromeHomes()) {
    const bin = home + "/chrome-headless-shell-linux64/chrome-headless-shell";
    if (existsSync(bin)) {
      return bin;
    }
  }
  return "";
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
    installedBinary()
  ];
  return candidates.find(function (path) {
    return path && existsSync(path);
  }) || "";
}

function extractZip(zip, dir) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    function finish(error) {
      if (settled) {
        return;
      }
      settled = true;
      if (error) reject(error);
      else resolve();
    }
    function runUnzip() {
      const unzip = spawn("unzip", ["-o", zip, "-d", dir], { stdio: "ignore" });
      unzip.on("error", function () {
        finish(new Error("unzip"));
      });
      unzip.on("exit", function (code) {
        finish(code === 0 ? null : new Error("unzip"));
      });
    }
    const python = spawn("python3", ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zip, dir], { stdio: "ignore" });
    python.on("error", runUnzip);
    python.on("exit", function (code) {
      if (code === 0) finish(null);
      else runUnzip();
    });
  });
}

async function installChrome() {
  let lastError = null;
  for (const home of chromeHomes()) {
    try {
      mkdirSync(home, { recursive: true });
      const zip = home + "/chrome.zip";
      const response = await fetch(CHROME_URL, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) {
        throw new Error("download");
      }
      writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
      await extractZip(zip, home);
      const bin = home + "/chrome-headless-shell-linux64/chrome-headless-shell";
      chmodSync(bin, 0o755);
      rmSync(zip, { force: true });
      return bin;
    } catch (error) {
      lastError = error;
    }
  }
  const failure = new Error("服务器上还没有浏览器，账号登录开不了");
  failure.code = "browser";
  failure.cause = lastError;
  throw failure;
}

export function libraryPackageNames(soname) {
  if (SYSTEM_SONAMES.has(soname)) {
    return [];
  }
  if (SONAME_PACKAGES[soname]) {
    return SONAME_PACKAGES[soname].slice();
  }
  const match = String(soname || "").match(/^(.*)\.so\.(\d+)$/);
  if (!match || match[1].includes(".")) {
    return [];
  }
  const plain = match[1] + match[2];
  const dashed = match[1] + "-" + match[2];
  return [plain + "t64", dashed + "t64", plain, dashed];
}

export function packageFilename(indexText, packageName) {
  const blocks = String(indexText || "").split("\n\n");
  for (let i = 0; i < blocks.length; i += 1) {
    const pkg = blocks[i].match(/^Package: (.+)$/m);
    const file = blocks[i].match(/^Filename: (.+)$/m);
    if (pkg && file && pkg[1].trim() === packageName) {
      return file[1].trim();
    }
  }
  return "";
}

export function suiteForGlibc(version) {
  const parts = String(version || "").split(".").map(Number);
  const level = (parts[0] || 0) * 100 + (parts[1] || 0);
  if (level >= 239) {
    return "noble";
  }
  if (level >= 235) {
    return "jammy";
  }
  return "focal";
}

function linuxDistro() {
  let text = "";
  try {
    text = readFileSync("/etc/os-release", "utf8");
  } catch {
    text = "";
  }
  const value = function (key) {
    const match = text.match(new RegExp("^" + key + "=(.*)$", "m"));
    return match ? match[1].trim().replace(/^"|"$/g, "") : "";
  };
  const id = value("ID");
  const like = value("ID_LIKE");
  const code = value("VERSION_CODENAME");
  if (code) {
    if (id === "debian" || (like.includes("debian") && !like.includes("ubuntu") && id !== "ubuntu")) {
      return { kind: "debian", suite: code };
    }
    return { kind: "ubuntu", suite: code };
  }
  let glibc = "";
  try {
    glibc = String((process.report.getReport().header || {}).glibcVersionRuntime || "");
  } catch {
    glibc = "";
  }
  return { kind: "ubuntu", suite: suiteForGlibc(glibc) };
}

function olderSuite(suite) {
  const ubuntu = ["noble", "jammy", "focal"];
  const debian = ["trixie", "bookworm", "bullseye"];
  const list = debian.indexOf(suite) >= 0 ? debian : ubuntu;
  const index = list.indexOf(suite);
  return index >= 0 && index < list.length - 1 ? list[index + 1] : "";
}

function distroMirrors(distro) {
  const urls = [];
  const files = ["/etc/apt/sources.list"];
  try {
    readdirSync("/etc/apt/sources.list.d").forEach(function (name) {
      files.push("/etc/apt/sources.list.d/" + name);
    });
  } catch {
    /* no apt sources */
  }
  files.forEach(function (file) {
    let body = "";
    try {
      body = readFileSync(file, "utf8");
    } catch {
      return;
    }
    body.split("\n").forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const deb = trimmed.match(/^deb(?:-src)?\s+(https?:\/\/\S+)/);
      const uri = trimmed.match(/^URIs:\s*(https?:\/\/\S+)/);
      const found = (deb && deb[1]) || (uri && uri[1]) || "";
      if (!found) {
        return;
      }
      const clean = found.replace(/\/$/, "");
      if (urls.indexOf(clean) < 0) {
        urls.push(clean);
      }
    });
  });
  const extras = distro.kind === "debian"
    ? ["https://mirrors.aliyun.com/debian", "https://mirrors.tuna.tsinghua.edu.cn/debian", "https://deb.debian.org/debian"]
    : ["https://mirrors.aliyun.com/ubuntu", "https://mirrors.tuna.tsinghua.edu.cn/ubuntu", "https://archive.ubuntu.com/ubuntu"];
  return extras.concat(urls.filter(function (url) {
    return extras.indexOf(url) < 0;
  }));
}

function libHome() {
  const homes = chromeHomes();
  for (let i = 0; i < homes.length; i += 1) {
    try {
      mkdirSync(homes[i] + "/libs", { recursive: true });
      return homes[i] + "/libs";
    } catch {
      /* try the next cache dir */
    }
  }
  return "";
}

function libSearchPath(home) {
  if (!home) {
    return "";
  }
  return [home + "/usr/lib/x86_64-linux-gnu", home + "/lib/x86_64-linux-gnu", home + "/usr/lib"].filter(function (dir) {
    return existsSync(dir);
  }).join(":");
}

function treeHas(dir, name, depth) {
  if (!dir || depth > 8 || !existsSync(dir)) {
    return false;
  }
  const entries = readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].isDirectory()) {
      if (treeHas(dir + "/" + entries[i].name, name, depth + 1)) {
        return true;
      }
    } else if (entries[i].name === name) {
      return true;
    }
  }
  return false;
}

function lddMissing(binary, extraPath) {
  return new Promise(function (resolve) {
    const env = Object.assign({}, process.env);
    if (extraPath) {
      env.LD_LIBRARY_PATH = extraPath + (env.LD_LIBRARY_PATH ? ":" + env.LD_LIBRARY_PATH : "");
    }
    const child = spawn("ldd", [binary], { env: env, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", function (chunk) {
      out += chunk.toString();
    });
    child.on("error", function () {
      resolve(null);
    });
    child.on("exit", function () {
      const names = [];
      out.split("\n").forEach(function (line) {
        if (!line.includes("not found")) {
          return;
        }
        const name = line.trim().split(/\s+/)[0];
        if (name && names.indexOf(name) < 0) {
          names.push(name);
        }
      });
      resolve(names);
    });
  });
}

function commandOk(cmd, args) {
  return new Promise(function (resolve) {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", function () {
      resolve(false);
    });
    child.on("exit", function (code) {
      resolve(code === 0);
    });
  });
}

function debDataTar(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from("!<arch>\n"))) {
    return null;
  }
  let off = 8;
  while (off + 60 <= bytes.length) {
    const name = bytes.subarray(off, off + 16).toString("ascii").replace(/\s+$/g, "").replace(/\/$/, "");
    const size = Number(bytes.subarray(off + 48, off + 58).toString("ascii").trim());
    off += 60;
    const body = bytes.subarray(off, off + size);
    off += size + (size & 1);
    if (name.startsWith("data.tar")) {
      return { name: name, body: body };
    }
  }
  return null;
}

function extractDebPython(deb, dest) {
  const script = [
    "import sys, io, tarfile, lzma, gzip",
    "deb, dest = sys.argv[1], sys.argv[2]",
    "data = open(deb, 'rb').read()",
    "if not data.startswith(b'!<arch>\\n'):",
    "    sys.exit(1)",
    "off = 8",
    "blob = None",
    "while off + 60 <= len(data):",
    "    name = data[off:off+16].decode('ascii', 'replace').strip().rstrip('/')",
    "    size = int(data[off+48:off+58].decode().strip() or '0')",
    "    off += 60",
    "    body = data[off:off+size]",
    "    off += size + (size & 1)",
    "    if name.startswith('data.tar'):",
    "        blob = (name, body)",
    "        break",
    "if blob is None:",
    "    sys.exit(1)",
    "name, body = blob",
    "if name.endswith('.xz'):",
    "    body = lzma.decompress(body)",
    "elif name.endswith('.gz'):",
    "    body = gzip.decompress(body)",
    "elif name.endswith('.zst') or name.endswith('.zstd'):",
    "    sys.exit(1)",
    "tarfile.open(fileobj=io.BytesIO(body), mode='r:').extractall(dest)"
  ].join("\n");
  return commandOk("python3", ["-c", script, deb, dest]);
}

async function extractDeb(deb, dest) {
  if (await commandOk("dpkg-deb", ["-x", deb, dest])) {
    return true;
  }
  const member = debDataTar(readFileSync(deb));
  if (!member) {
    return false;
  }
  if (member.name.endsWith(".xz") || member.name.endsWith(".gz")) {
    return extractDebPython(deb, dest);
  }
  let tar = member.body;
  if (member.name.endsWith(".zst") || member.name.endsWith(".zstd")) {
    if (typeof zlib.zstdDecompressSync !== "function") {
      libraryNote = "这版 Node 解不开压缩包";
      return false;
    }
    tar = zlib.zstdDecompressSync(tar);
  }
  const tarPath = dest + "/data.tar";
  writeFileSync(tarPath, tar);
  const extracted = await commandOk("python3", ["-c", "import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2])", tarPath, dest]);
  rmSync(tarPath, { force: true });
  return extracted;
}

async function loadPackageIndex(distro) {
  if (packageIndex && packageIndex.suite === distro.suite && packageIndex.kind === distro.kind) {
    return packageIndex;
  }
  const mirrors = distroMirrors(distro);
  let lastError = null;
  for (let i = 0; i < mirrors.length; i += 1) {
    try {
      const response = await fetch(mirrors[i] + "/dists/" + distro.suite + "/main/binary-amd64/Packages.gz", { signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        throw new Error("index");
      }
      const text = zlib.gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
      packageIndex = { suite: distro.suite, kind: distro.kind, mirror: mirrors[i], text: text };
      return packageIndex;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("index");
}

async function downloadSonames(home, names, suite) {
  if (!home || !names.length) {
    return false;
  }
  const distro = linuxDistro();
  if (suite) {
    distro.suite = suite;
  }
  let index = null;
  try {
    index = await loadPackageIndex(distro);
  } catch {
    libraryNote = distro.suite + " 的软件源没有打开";
    return false;
  }
  let installed = false;
  for (let i = 0; i < names.length; i += 1) {
    const packages = libraryPackageNames(names[i]);
    if (treeHas(home, names[i], 0)) {
      continue;
    }
    for (let p = 0; p < packages.length; p += 1) {
      const filename = packageFilename(index.text, packages[p]);
      if (!filename) {
        continue;
      }
      const deb = home + "/debs/" + packages[p] + ".deb";
      try {
        mkdirSync(home + "/debs", { recursive: true });
        const response = await fetch(index.mirror.replace(/\/$/, "") + "/" + filename, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) {
          libraryNote = libraryNote || ("安装包下载失败 " + response.status);
          continue;
        }
        writeFileSync(deb, Buffer.from(await response.arrayBuffer()));
        const extracted = await extractDeb(deb, home);
        rmSync(deb, { force: true });
        if (extracted && treeHas(home, names[i], 0)) {
          installed = true;
          break;
        }
        libraryNote = libraryNote || "安装包解不开";
      } catch (error) {
        const code = (error && (error.code || error.message)) || "下载失败";
        if (!installed || code === "ENOSPC" || String(code).includes("no space")) {
          libraryNote = code;
        }
        rmSync(deb, { force: true });
      }
    }
  }
  if (installed && libraryNote !== "ENOSPC" && !String(libraryNote).includes("no space")) {
    libraryNote = "";
  } else if (!installed && !libraryNote) {
    libraryNote = "软件源里没有 " + names[0];
  }
  return installed;
}

function installLibraries(chromePath) {
  if (libraryTask) {
    return libraryTask;
  }
  libraryTask = fillLibraries(chromePath).then(function (path) {
    libraryTask = null;
    return path;
  }, function () {
    libraryTask = null;
    return libraryPath;
  });
  return libraryTask;
}

function removeSoname(home, name) {
  if (!home || !name || !existsSync(home)) {
    return;
  }
  const stack = [home];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (let i = 0; i < entries.length; i += 1) {
      const path = dir + "/" + entries[i].name;
      if (entries[i].isDirectory()) {
        stack.push(path);
      } else if (entries[i].name === name) {
        try {
          unlinkSync(path);
        } catch {
          /* file already gone */
        }
      }
    }
  }
}

function cleanStaleProfiles() {
  let names = [];
  try {
    names = readdirSync(tmpdir());
  } catch {
    return;
  }
  names.forEach(function (name) {
    if (name.startsWith("shen-jingmai-")) {
      rmSync(tmpdir() + "/" + name, { recursive: true, force: true });
    }
  });
}

function cacheHomes() {
  const homes = [];
  chromeHomes().forEach(function (home) {
    try {
      mkdirSync(home + "/libs", { recursive: true });
      homes.push(home + "/libs");
    } catch {
      /* this cache dir is not writable */
    }
  });
  return homes;
}

function readableNote(note) {
  if (!note) {
    return "";
  }
  if (note === "ENOSPC" || note.includes("no space")) {
    return "服务器磁盘满了，库没写进去";
  }
  return note;
}

async function fillLibraries(chromePath) {
  if (!chromePath) {
    return libraryPath;
  }
  cleanStaleProfiles();
  const homes = cacheHomes();
  if (!homes.length) {
    libraryNote = "没有可写的目录放浏览器库";
    return libraryPath;
  }
  let last = libraryPath;
  for (let i = 0; i < homes.length; i += 1) {
    libraryNote = "";
    last = await fillLibraryHome(homes[i], chromePath);
    if (!libraryNote) {
      libraryPath = last;
      return last;
    }
  }
  libraryPath = last;
  return last;
}

async function fillLibraryHome(home, chromePath) {
  for (let round = 0; round < 8; round += 1) {
    const missing = await lddMissing(chromePath, libSearchPath(home));
    if (!missing) {
      break;
    }
    const needed = missing.filter(function (name) {
      return !SYSTEM_SONAMES.has(name) && !treeHas(home, name, 0);
    });
    if (!needed.length) {
      break;
    }
    const installed = await downloadSonames(home, needed);
    if (!installed) {
      break;
    }
  }
  libraryPath = libSearchPath(home);
  return libraryPath;
}

export function ensureChrome() {
  const existing = findChrome();
  const pending = existing ? Promise.resolve(existing) : chromeInstall || (chromeInstall = installChrome().catch(function (error) {
    chromeInstall = null;
    throw error;
  }));
  return pending.then(function (bin) {
    return installLibraries(bin).then(function () {
      return bin;
    });
  });
}

function send(ws, method, params, sessionId) {
  const id = ws.__seq = (ws.__seq || 0) + 1;
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      ws.removeEventListener("message", onMessage);
      reject(new Error(method + " timeout"));
    }, 15000);
    function onMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id !== id) {
        return;
      }
      if (sessionId && message.sessionId && message.sessionId !== sessionId) {
        return;
      }
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (message.error) {
        reject(new Error(method));
      } else {
        resolve(message.result || {});
      }
    }
    ws.addEventListener("message", onMessage);
    const payload = { id: id, method: method, params: params || {} };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    ws.send(JSON.stringify(payload));
  });
}

function evaluate(ws, expression) {
  return send(ws, "Runtime.evaluate", { expression: expression, returnByValue: true, awaitPromise: true }).then(function (result) {
    if (result.exceptionDetails) {
      return null;
    }
    return result.result ? result.result.value : null;
  });
}

function discard(desk) {
  if (!desk) {
    return;
  }
  if (current === desk) {
    stopCurrent();
    return;
  }
  desk.password = "";
  try {
    if (desk.ws) {
      desk.ws.close();
    }
  } catch {
    /* already closed */
  }
  const removeDir = function () {
    try {
      rmSync(desk.dir, { recursive: true, force: true });
    } catch {
      /* temp dir already gone */
    }
  };
  try {
    if (desk.chrome && desk.chrome.exitCode == null) {
      desk.chrome.once("exit", removeDir);
      desk.chrome.kill("SIGKILL");
    } else {
      removeDir();
    }
  } catch {
    removeDir();
  }
}

function closeReader() {
  const desk = readerDesk;
  readerDesk = null;
  if (readerIdle) {
    clearTimeout(readerIdle);
    readerIdle = null;
  }
  if (desk) {
    discard(desk);
  }
}

function armReaderIdle() {
  if (readerIdle) {
    clearTimeout(readerIdle);
  }
  readerIdle = setTimeout(closeReader, 15000);
  if (readerIdle && typeof readerIdle.unref === "function") {
    readerIdle.unref();
  }
}

function stopCurrent() {
  readerDesk = null;
  if (readerIdle) {
    clearTimeout(readerIdle);
    readerIdle = null;
  }
  const desk = current;
  current = null;
  if (!desk) {
    return;
  }
  desk.password = "";
  try {
    if (desk.ws) {
      desk.ws.close();
    }
  } catch {
    /* already closed */
  }
  const removeDir = function () {
    try {
      rmSync(desk.dir, { recursive: true, force: true });
    } catch {
      /* temp dir already gone */
    }
  };
  try {
    if (desk.chrome && desk.chrome.exitCode == null) {
      desk.chrome.once("exit", removeDir);
      desk.chrome.kill("SIGKILL");
    } else {
      removeDir();
    }
  } catch {
    removeDir();
  }
}

function encodeFrame(text) {
  const payload = Buffer.from(String(text));
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0xfe;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0xff;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function openSocket(url) {
  const parsed = new URL(url);
  const socket = connectTcp(Number(parsed.port), parsed.hostname);
  const listeners = { open: [], message: [], error: [] };
  let buf = Buffer.alloc(0);
  let opened = false;
  let fragments = [];
  const ws = {
    addEventListener: function (type, fn) {
      (listeners[type] || (listeners[type] = [])).push(fn);
    },
    removeEventListener: function (type, fn) {
      listeners[type] = (listeners[type] || []).filter(function (item) {
        return item !== fn;
      });
    },
    send: function (data) {
      socket.write(encodeFrame(data));
    },
    close: function () {
      socket.end();
    }
  };
  function emit(type, event) {
    (listeners[type] || []).forEach(function (fn) {
      fn(event);
    });
  }
  function takeFrame() {
    if (buf.length < 2) {
      return false;
    }
    const fin = (buf[0] & 128) !== 0;
    const opcode = buf[0] & 15;
    let size = buf[1] & 127;
    let offset = 2;
    if (size === 126) {
      if (buf.length < 4) {
        return false;
      }
      size = buf.readUInt16BE(2);
      offset = 4;
    } else if (size === 127) {
      if (buf.length < 10) {
        return false;
      }
      size = Number(buf.readBigUInt64BE(2));
      offset = 10;
    }
    if (buf.length < offset + size) {
      return false;
    }
    const payload = buf.slice(offset, offset + size);
    buf = buf.slice(offset + size);
    if (opcode === 8) {
      socket.end();
      return true;
    }
    if (opcode === 1 || opcode === 0) {
      fragments.push(payload);
      if (fin) {
        const text = Buffer.concat(fragments).toString();
        fragments = [];
        emit("message", { data: text });
      }
    }
    return true;
  }
  socket.on("error", function () {
    emit("error", {});
  });
  socket.on("data", function (chunk) {
    buf = Buffer.concat([buf, chunk]);
    if (!opened) {
      const split = buf.indexOf("\r\n\r\n");
      if (split < 0) {
        return;
      }
      const header = buf.slice(0, split).toString();
      buf = buf.slice(split + 4);
      if (!header.includes(" 101 ")) {
        emit("error", {});
        socket.destroy();
        return;
      }
      opened = true;
      emit("open", {});
    }
    while (takeFrame()) {
      /* drain */
    }
  });
  socket.on("connect", function () {
    socket.write(
      "GET " + (parsed.pathname || "/") + parsed.search + " HTTP/1.1\r\n" +
      "Host: " + parsed.host + "\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Key: " + randomBytes(16).toString("base64") + "\r\n" +
      "Sec-WebSocket-Version: 13\r\n\r\n"
    );
  });
  return ws;
}

function connectSocket(url) {
  const ws = openSocket(url);
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("socket"));
    }, 8000);
    ws.addEventListener("open", function () {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", function () {
      clearTimeout(timer);
      reject(new Error("socket"));
    });
  });
}

function browserFailure(stderr) {
  const text = String(stderr || "");
  const library = text.match(/error while loading shared libraries: (\S+)/);
  if (library) {
    return "服务器浏览器缺少 " + library[1].replace(/[,:]/g, "") + "，登录开不了";
  }
  const glibc = text.match(/version `([^']+)' not found/);
  if (glibc) {
    const libs = text.match(/[\w.+-]+\.so(?:\.\d+)*/g) || [];
    const lib = libs.length ? libs[libs.length - 1] : "库";
    return "服务器上的 " + lib + " 需要 " + glibc[1] + "，这台机器没有";
  }
  if (text.includes("Permission denied") || text.includes("EACCES")) {
    return "服务器浏览器没有执行权限，登录开不了";
  }
  const line = text.split("\n").map(function (item) {
    return item.trim();
  }).filter(function (item) {
    return item && !item.includes("dbus") && !item.includes("DevTools");
  }).pop();
  if (line) {
    return "服务器登录没有打开：" + (line.length > 160 ? line.slice(-160) : line);
  }
  return "服务器登录没有打开";
}

async function launchChrome() {
  let chromePath = "";
  try {
    chromePath = await ensureChrome();
  } catch (error) {
    if (error && error.code === "browser") {
      throw error;
    }
    const wrapped = new Error("服务器上还没有浏览器，账号登录开不了");
    wrapped.code = "browser";
    throw wrapped;
  }
  if (!chromePath) {
    const error = new Error("服务器上还没有浏览器，账号登录开不了");
    error.code = "browser";
    throw error;
  }
  const tried = new Set();
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await startChromeProcess(chromePath);
    } catch (error) {
      lastError = error;
      const message = String(error && error.message || "");
      const match = message.match(/缺少 ([A-Za-z0-9._+-]+)/) || message.match(/服务器上的 ([A-Za-z0-9._+-]+\.so(?:\.\d+)*)/);
      if (!match || tried.has(match[1])) {
        throw error;
      }
      tried.add(match[1]);
      const home = libHome();
      const mismatched = message.includes("这台机器没有");
      if (mismatched) {
        removeSoname(home, match[1]);
      }
      const suite = mismatched ? olderSuite(linuxDistro().suite) : "";
      const installed = await downloadSonames(home, [match[1]], suite);
      libraryPath = libSearchPath(home);
      if (!installed) {
        if (libraryNote) {
          error.message = message + "。" + readableNote(libraryNote);
        }
        throw error;
      }
    }
  }
  throw lastError || new Error("服务器登录没有打开");
}

async function startChromeProcess(chromePath) {
  const dir = mkdtempSync(tmpdir() + "/shen-jingmai-");
  const env = Object.assign({}, process.env);
  if (libraryPath) {
    env.LD_LIBRARY_PATH = libraryPath + (env.LD_LIBRARY_PATH ? ":" + env.LD_LIBRARY_PATH : "");
  }
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--lang=zh-CN",
    "--window-size=1100,720",
    "--user-data-dir=" + dir,
    "--remote-debugging-port=0",
    "about:blank"
  ], { env: env, stdio: ["ignore", "ignore", "pipe"] });
  try {
    let buf = "";
    const port = await new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(Object.assign(new Error(browserFailure(buf)), { code: "browser" }));
      }, 15000);
      chrome.on("error", function () {
        clearTimeout(timer);
        reject(Object.assign(new Error(browserFailure(buf || "spawn")), { code: "browser" }));
      });
      chrome.stderr.on("data", function (chunk) {
        buf = (buf + chunk.toString()).slice(-2000);
        const match = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      chrome.on("exit", function () {
        clearTimeout(timer);
        reject(Object.assign(new Error(browserFailure(buf)), { code: "browser" }));
      });
    });
    const list = await fetch("http://127.0.0.1:" + port + "/json/list").then(function (response) {
      return response.json();
    });
    const page = list.find(function (item) {
      return item.type === "page";
    });
    const ws = await connectSocket(page.webSocketDebuggerUrl);
    return { chrome: chrome, dir: dir, ws: ws, port: port, password: "" };
  } catch (error) {
    try {
      chrome.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

async function readCookies(ws) {
  const result = await send(ws, "Network.getCookies", {});
  return (result.cookies || [])
    .filter(function (cookie) {
      return String(cookie.domain || "").includes("jd.com") && cookie.name && cookie.value;
    })
    .map(function (cookie) {
      return { name: cookie.name, value: cookie.value };
    });
}

function hasSession(cookies) {
  return cookies.some(function (cookie) {
    return SESSION_NAMES.has(cookie.name) && cookie.value;
  });
}

async function pageText(ws) {
  const text = await evaluate(ws, "document.body ? document.body.innerText.slice(0, 500) : ''");
  return String(text || "");
}

export function loginScreenState(text, formReady) {
  const source = String(text || "");
  if (source.includes("不匹配") || source.includes("密码不正确") || source.includes("账号或密码")) {
    return { status: "login", message: "账号或密码不正确" };
  }
  if (source.includes("冻结") || source.includes("停用")) {
    return { status: "login", message: "这个账号现在不能登录" };
  }
  if (!formReady && /登录异常|登录环境异常|暂时无法登录/.test(source)) {
    return { status: "verify", message: "京麦拒绝了这次服务器登录，请过一会儿再试" };
  }
  return { status: "verify", message: "" };
}

async function readScreenState(ws) {
  const formReady = Boolean(
    await evaluate(ws, "!![...document.querySelectorAll('input')].find((node) => (node.placeholder || '').includes('账号'))")
  );
  return loginScreenState(await pageText(ws), formReady);
}

async function fillAndSubmit(ws, loginName, password) {
  const accountReady = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll("input")].find((node) => (node.placeholder || "").includes("账号"));
    if (!el) return false;
    el.focus();
    return true;
  })()`);
  if (!accountReady) {
    return false;
  }
  await send(ws, "Input.insertText", { text: loginName });
  const passwordReady = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll("input")].find((node) => (node.placeholder || "").includes("密码"));
    if (!el) return false;
    el.focus();
    return true;
  })()`);
  if (!passwordReady) {
    return false;
  }
  await send(ws, "Input.insertText", { text: password });
  return evaluate(ws, `(() => {
    const button = [...document.querySelectorAll("button")].find((node) => (node.innerText || "").includes("立即登录"));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

export function browserReady() {
  return Boolean(findChrome());
}

export function resetDesk() {
  stopCurrent();
}

export async function closeDesk() {
  stopCurrent();
}

export async function openDesk({ store, loginName, password }) {
  stopCurrent();
  let desk = null;
  try {
    desk = await launchChrome();
    desk.store = store;
    current = desk;
    await send(desk.ws, "Page.enable");
    await send(desk.ws, "Network.enable");
    await send(desk.ws, "Emulation.setDeviceMetricsOverride", {
      width: 1100,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send(desk.ws, "Page.navigate", { url: LOGIN_URL });
    let ready = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(700);
      ready = Boolean(await evaluate(desk.ws, "!![...document.querySelectorAll('input')].find((node) => (node.placeholder || '').includes('账号'))"));
      if (ready) {
        break;
      }
    }
    if (!ready) {
      stopCurrent();
      return { status: "login", message: "服务器没有打开京麦登录页" };
    }
    const submitted = await fillAndSubmit(desk.ws, loginName, password);
    password = "";
    if (!submitted) {
      stopCurrent();
      return { status: "login", message: "服务器没有填上账号" };
    }
    let cookies = [];
    let screen = { status: "verify", message: "" };
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await sleep(attempt === 0 ? 1200 : 1000);
      try {
        cookies = await readCookies(desk.ws);
      } catch {
        cookies = [];
      }
      if (hasSession(cookies)) {
        stopCurrent();
        return { status: "ok", cookies: cookies };
      }
      try {
        screen = await readScreenState(desk.ws);
      } catch {
        screen = { status: "verify", message: "" };
      }
      if (screen.status === "login") {
        stopCurrent();
        return screen;
      }
      if (screen.message && /滑块|验证码|安全验证|请过一会儿再试/.test(screen.message)) {
        return screen;
      }
    }
    return screen;
  } catch (error) {
    stopCurrent();
    if (error && error.code === "browser") {
      return { status: "login", message: error.message };
    }
    return { status: "login", message: "服务器登录没有打开" };
  } finally {
    password = "";
    if (desk) {
      desk.password = "";
    }
  }
}

export async function pollDesk(store) {
  if (!current || current.store !== store || !current.ws) {
    return { status: "missing", message: "请重新打开登录" };
  }
  try {
    const cookies = await readCookies(current.ws);
    if (hasSession(cookies)) {
      return { status: "ok", cookies: cookies };
    }
    return readScreenState(current.ws);
  } catch {
    return { status: "login", message: "服务器登录中断了" };
  }
}

export async function shotDesk(store) {
  if (!current || current.store !== store || !current.ws) {
    return null;
  }
  try {
    const shot = await send(current.ws, "Page.captureScreenshot", { format: "jpeg", quality: 60 });
    return Buffer.from(shot.data || "", "base64");
  } catch {
    return null;
  }
}

export async function clickDesk(store, x, y) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  const point = { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
  await send(current.ws, "Input.dispatchMouseEvent", Object.assign({ type: "mousePressed", button: "left", clickCount: 1 }, point));
  await send(current.ws, "Input.dispatchMouseEvent", Object.assign({ type: "mouseReleased", button: "left", clickCount: 1 }, point));
}

export async function typeDesk(store, text) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  const value = String(text || "").slice(0, 20);
  if (!value) {
    return;
  }
  await send(current.ws, "Input.insertText", { text: value });
}

function watchShopData(ws) {
  return new Promise(function (resolve) {
    const timer = setTimeout(function () {
      ws.removeEventListener("message", onMessage);
      resolve("");
    }, 25000);
    function finish(text) {
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      resolve(text || "");
    }
    function onMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.method === "Target.attachedToTarget" && message.params && message.params.sessionId) {
        send(ws, "Network.enable", {}, message.params.sessionId).catch(function () {});
        return;
      }
      if (message.method === "Network.responseReceived") {
        const url = message.params && message.params.response ? String(message.params.response.url || "") : "";
        if (url.includes("findShopDataByChannel") || url.includes("sff.jd.com") || url.includes("getSummary")) {
          ws.__shopRequests = ws.__shopRequests || new Map();
          ws.__shopRequests.set(message.params.requestId, message.sessionId || "");
        }
        return;
      }
      if (message.method !== "Network.loadingFinished" || !ws.__shopRequests || !ws.__shopRequests.has(message.params.requestId)) {
        return;
      }
      const sessionId = ws.__shopRequests.get(message.params.requestId);
      send(ws, "Network.getResponseBody", { requestId: message.params.requestId }, sessionId).then(function (result) {
        const text = result.base64Encoded ? Buffer.from(result.body || "", "base64").toString("utf8") : String(result.body || "");
        try {
          if (extractShopDeal(JSON.parse(text))) {
            finish(text);
          }
        } catch {
          /* keep waiting for the card response */
        }
      }).catch(function () {});
    }
    ws.addEventListener("message", onMessage);
  });
}

let dealQueue = Promise.resolve();

async function prepareReader() {
  if (current && current !== readerDesk) {
    return null;
  }
  if (readerDesk && readerDesk.ws) {
    return readerDesk;
  }
  const desk = await launchChrome();
  if (current) {
    discard(desk);
    return null;
  }
  current = desk;
  readerDesk = desk;
  const ws = desk.ws;
  await send(ws, "Page.enable");
  await send(ws, "Network.enable");
  try {
    await send(ws, "Network.setCacheDisabled", { cacheDisabled: true });
  } catch {
    /* cache disable is optional */
  }
  try {
    await send(ws, "Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  } catch {
    /* this page target does not attach child frames */
  }
  return desk;
}

function cookieParams(cookies) {
  return (cookies || [])
    .filter(function (item) {
      return item && item.name && item.value != null;
    })
    .map(function (item) {
      return {
        name: String(item.name),
        value: String(item.value),
        domain: ".jd.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "None"
      };
    });
}

function homeCardText(ws) {
  return evaluate(ws, `(() => {
    const parts = [];
    const take = (node) => {
      if (!node) return;
      if (node.body) parts.push(node.body.innerText || "");
      else if (node.innerText) parts.push(node.innerText);
      const nodes = node.querySelectorAll ? node.querySelectorAll("*") : [];
      nodes.forEach((el) => { if (el.shadowRoot) take(el.shadowRoot); });
    };
    take(document);
    document.querySelectorAll("iframe").forEach((frame) => { try { take(frame.contentDocument); } catch (e) {} });
    return parts.join("\\n").slice(0, 12000);
  })()`);
}

async function readHomeDealNow(cookies) {
  if (readerIdle) {
    clearTimeout(readerIdle);
    readerIdle = null;
  }
  try {
    const desk = await prepareReader();
    if (!desk) {
      return null;
    }
    const ws = desk.ws;
    ws.__shopRequests = new Map();
    try {
      await send(ws, "Network.clearBrowserCookies");
    } catch {
      /* older chrome still replaces cookies by name */
    }
    try {
      await send(ws, "Page.navigate", { url: "about:blank" });
    } catch {
      /* a fresh target can reject the first navigation */
    }
    await sleep(300);
    let networkDone = false;
    const pending = watchShopData(ws).then(function (body) {
      networkDone = true;
      return body;
    });
    const jar = cookieParams(cookies);
    if (jar.length) {
      await send(ws, "Network.setCookies", { cookies: jar });
    }
    await send(ws, "Page.navigate", { url: "https://shop.jd.com/jdm/home" });
    let card = null;
    for (let attempt = 0; attempt < 12 && !card && !networkDone; attempt += 1) {
      await sleep(1000);
      card = parseHomeCard(await homeCardText(ws));
    }
    if (card) {
      return card;
    }
    const body = await pending;
    if (body) {
      try {
        const metrics = extractShopDeal(JSON.parse(body));
        if (metrics) {
          return metrics;
        }
      } catch {
        /* fall through to the rendered card */
      }
    }
    card = parseHomeCard(await homeCardText(ws));
    if (card) {
      return card;
    }
    const error = new Error("京麦首页卡片没有成交金额");
    error.code = "network";
    throw error;
  } catch (error) {
    const keep = error && error.code === "network" && /没有成交金额/.test(String(error.message || ""));
    if (!keep) {
      closeReader();
    }
    if (error && error.code === "network") {
      throw error;
    }
    if (error && error.code === "browser") {
      return null;
    }
    const wrapped = new Error("京麦首页卡片没有打开");
    wrapped.code = "network";
    throw wrapped;
  } finally {
    if (readerDesk) {
      armReaderIdle();
    }
  }
}

export function readHomeDeal(cookies) {
  const job = dealQueue.then(function () {
    return withDeadline(function () {
      return readHomeDealNow(cookies);
    }, 45000);
  });
  dealQueue = job.then(function () {
    return null;
  }, function () {
    return null;
  });
  return job;
}

const STOCK_PAGE = "https://trade-warehousing-jdm.jd.com/inventory-manage";
const STOCK_NEXT =
  '(() => { const docs = [document]; document.querySelectorAll("iframe").forEach((frame) => { try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (e) {} }); for (const doc of docs) { const next = doc.querySelector(".jd-pagination .btn-next, .el-pagination .btn-next, button.btn-next"); if (!next) continue; const disabled = next.disabled || next.classList.contains("is-disabled") || next.getAttribute("aria-disabled") === "true"; if (disabled) return "end"; next.click(); return "next"; } return "no-pager"; })()';
function stockPick(labelText, wanted) {
  return (
    "(() => { const labelText = " +
    JSON.stringify(labelText) +
    "; const wanted = " +
    JSON.stringify(wanted) +
    '; const docs = [document]; document.querySelectorAll("iframe").forEach((frame) => { try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (e) {} }); const norm = (value) => String(value || "").replace(/\\s+/g, ""); const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 2 && rect.height > 2; }; for (const doc of docs) { const options = doc.querySelectorAll(".jd-select-dropdown__item, .el-select-dropdown__item, [role=\\"option\\"]"); for (const option of options) { if (norm(option.innerText) !== wanted || !visible(option)) continue; const panel = option.closest(".jd-select-dropdown, .el-select-dropdown, [role=\\"listbox\\"]"); if (panel && !visible(panel)) continue; option.click(); return "picked"; } } for (const doc of docs) { const labels = doc.querySelectorAll("label, .jd-form-item__label, .el-form-item__label"); for (const label of labels) { if (norm(label.innerText).indexOf(labelText) === -1) continue; const item = label.closest(".jd-form-item, .el-form-item") || label.parentElement; const select = item && item.querySelector(".jd-select, .el-select"); if (!select) continue; const chosen = select.querySelector(".jd-select__selected-item, .el-select__selected-item, .jd-input__inner, input"); const current = norm(chosen ? chosen.value || chosen.innerText || chosen.textContent : ""); if (current === wanted) return "already"; select.click(); return "open"; } } return "missing"; })()'
  );
}

function postedFilter(post) {
  try {
    const data = JSON.parse(String(post || "")).request.data;
    const codes = Array.isArray(data.searchFeatureCodes) ? data.searchFeatureCodes.filter(Boolean) : [];
    const status = Array.isArray(data.skuPStatuses) ? data.skuPStatuses.filter(Boolean) : [];
    return codes.length > 0 && status.length > 0;
  } catch {
    return false;
  }
}

const STOCK_SEARCH =
  '(() => { const docs = [document]; document.querySelectorAll("iframe").forEach((frame) => { try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (e) {} }); const norm = (value) => String(value || "").replace(/\\s+/g, ""); for (const doc of docs) { const buttons = doc.querySelectorAll("button"); for (const button of buttons) { if (norm(button.innerText) !== "查询") continue; const rect = button.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) continue; button.click(); return "search"; } } return "no-search"; })()';

function watchStock(ws) {
  const queue = [];
  let waiter = null;
  ws.__stockRequests = new Map();
  ws.__stockPosts = new Map();
  function push(entry) {
    if (!entry || !entry.text) {
      return;
    }
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(entry);
    } else {
      queue.push(entry);
    }
  }
  function onMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.method === "Target.attachedToTarget" && message.params && message.params.sessionId) {
      send(ws, "Network.enable", {}, message.params.sessionId).catch(function () {});
      return;
    }
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params && message.params.request ? message.params.request : {};
      if (String(request.url || "").includes("queryStockByPage")) {
        ws.__stockPosts.set(message.params.requestId, String(request.postData || ""));
      }
      return;
    }
    if (message.method === "Network.responseReceived") {
      const url = message.params && message.params.response ? message.params.response.url : "";
      if (String(url).includes("queryStockByPage")) {
        ws.__stockRequests.set(message.params.requestId, message.sessionId || "");
      }
      return;
    }
    if (message.method !== "Network.loadingFinished" || !ws.__stockRequests.has(message.params.requestId)) {
      return;
    }
    const sessionId = ws.__stockRequests.get(message.params.requestId);
    const post = ws.__stockPosts.get(message.params.requestId) || "";
    ws.__stockRequests.delete(message.params.requestId);
    ws.__stockPosts.delete(message.params.requestId);
    send(ws, "Network.getResponseBody", { requestId: message.params.requestId }, sessionId)
      .then(function (result) {
        const text = result.base64Encoded ? Buffer.from(result.body || "", "base64").toString("utf8") : String(result.body || "");
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          push({ text: trimmed, post: post });
        }
      })
      .catch(function () {});
  }
  ws.addEventListener("message", onMessage);
  return {
    next: function (ms) {
      if (queue.length) {
        return Promise.resolve(queue.shift());
      }
      return new Promise(function (resolve) {
        const timer = setTimeout(function () {
          waiter = null;
          resolve("");
        }, ms);
        waiter = function (text) {
          clearTimeout(timer);
          resolve(text);
        };
      });
    },
    stop: function () {
      waiter = null;
      ws.removeEventListener("message", onMessage);
    }
  };
}

async function readShopStockNow(cookies) {
  if (readerIdle) {
    clearTimeout(readerIdle);
    readerIdle = null;
  }
  let watch = null;
  try {
    const desk = await prepareReader();
    if (!desk) {
      return null;
    }
    const ws = desk.ws;
    try {
      await send(ws, "Network.clearBrowserCookies");
    } catch {
      /* older chrome still replaces cookies by name */
    }
    try {
      await send(ws, "Page.navigate", { url: "about:blank" });
    } catch {
      /* a fresh target can reject the first navigation */
    }
    await sleep(300);
    watch = watchStock(ws);
    const jar = cookieParams(cookies);
    if (jar.length) {
      await send(ws, "Network.setCookies", { cookies: jar });
    }
    await send(ws, "Page.navigate", { url: STOCK_PAGE });
    const first = await watch.next(30000);
    if (!first || !first.text) {
      const href = await evaluate(ws, "location.href");
      if (/passport|login/i.test(String(href || ""))) {
        const error = new Error("登录已失效，请重新登录");
        error.code = "login";
        throw error;
      }
      const error = new Error("京仓库存页面没有返回");
      error.code = "network";
      throw error;
    }
    async function choose(label, option) {
      let action = "missing";
      for (let attempt = 0; attempt < 4; attempt += 1) {
        action = await evaluate(ws, stockPick(label, option));
        if (action === "already" || action === "picked" || action === "missing") {
          return action || "missing";
        }
        await sleep(400);
      }
      return action || "open";
    }
    const statusAction = await choose("商品状态", "在售");
    const labelAction = await choose("商品标签", "京东物流");
    let stray = await watch.next(400);
    let lastStray = null;
    for (let extra = 0; extra < 6 && stray; extra += 1) {
      lastStray = stray;
      stray = await watch.next(300);
    }
    const searched = await evaluate(ws, STOCK_SEARCH);
    let pageOne = null;
    for (let wait = 0; wait < 4 && !(pageOne && postedFilter(pageOne.post)); wait += 1) {
      const entry = await watch.next(wait === 0 ? 15000 : 4000);
      if (!entry || !entry.text) {
        break;
      }
      pageOne = entry;
    }
    if ((!pageOne || !pageOne.text) && lastStray && lastStray.text && searched !== "search") {
      pageOne = lastStray;
    }
    const texts = [];
    const posts = [];
    if (pageOne && pageOne.text) {
      texts.push(pageOne.text);
      posts.push(pageOne.post || "");
    }
    for (let page = 0; page < 20 && texts.length; page += 1) {
      const action = await evaluate(ws, STOCK_NEXT);
      if (action !== "next") {
        break;
      }
      let more = await watch.next(12000);
      if (!more || !more.text) {
        more = await watch.next(8000);
      }
      if (!more || !more.text) {
        break;
      }
      texts.push(more.text);
      posts.push(more.post || "");
    }
    const chose = (statusAction === "already" || statusAction === "picked") && (labelAction === "already" || labelAction === "picked");
    return { texts: texts, posts: posts, chose: chose };
  } catch (error) {
    if (!error || error.code !== "network") {
      closeReader();
    }
    if (error && (error.code === "login" || error.code === "network")) {
      throw error;
    }
    const wrapped = new Error("京仓库存页面没有打开");
    wrapped.code = "network";
    throw wrapped;
  } finally {
    if (watch) {
      watch.stop();
    }
    if (readerDesk) {
      armReaderIdle();
    }
  }
}

export function readShopStock(cookies) {
  const job = dealQueue.then(function () {
    return withDeadline(function () {
      return readShopStockNow(cookies);
    }, 45000);
  });
  dealQueue = job.then(function () {
    return null;
  }, function () {
    return null;
  });
  return job;
}

export const jingmaiDesk = {
  open: openDesk,
  poll: pollDesk,
  shot: shotDesk,
  click: clickDesk,
  type: typeDesk,
  close: closeDesk,
  reset: resetDesk
};
