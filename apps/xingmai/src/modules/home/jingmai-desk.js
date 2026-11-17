import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { connect as connectTcp } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
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

let fontConfig = "";
let current = null;
let openTicket = 0;
let readerDesk = null;
let readerIdle = null;
let chromeInstall = null;
let libraryPath = "";
let libraryTask = null;
let libraryNote = "";
let packageIndex = null;

function chromeHomes() {
  const homes = [
    "/opt/mengkai/.shen-chrome",
    process.env.SHEN_CHROME_DIR,
    "/tmp/shen-chrome",
    tmpdir() + "/shen-chrome"
  ];
  const seen = new Set();
  return homes.filter(function (home) {
    if (!home || seen.has(home)) {
      return false;
    }
    seen.add(home);
    return true;
  });
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

export function hostChromePath(path) {
  const value = String(path || "");
  if (!value || value.includes("chrome-headless-shell")) {
    return "";
  }
  return value;
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

function findFontFile(dir, depth) {
  if (!dir || depth > 6) {
    return "";
  }
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return "";
  }
  for (let i = 0; i < names.length; i += 1) {
    const full = dir + "/" + names[i];
    if (/\.(?:ttf|otf|ttc)$/i.test(names[i])) {
      return full;
    }
  }
  for (let i = 0; i < names.length; i += 1) {
    const nested = findFontFile(dir + "/" + names[i], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return "";
}

async function ensureLoginFont() {
  const home = libHome();
  if (!home) {
    return "";
  }
  const root = home.replace(/\/libs$/, "");
  let fontDir = "";
  const existing = findFontFile(root + "/fonts", 0) || findFontFile(home + "/usr/share/fonts", 0);
  if (existing) {
    fontDir = existing.slice(0, existing.lastIndexOf("/"));
  } else {
    try {
      const distro = linuxDistro();
      const index = await loadPackageIndex(distro);
      const filename = packageFilename(index.text, "fonts-wqy-microhei");
      if (filename) {
        mkdirSync(home + "/debs", { recursive: true });
        const deb = home + "/debs/fonts-wqy-microhei.deb";
        const response = await fetch(index.mirror.replace(/\/$/, "") + "/" + filename, { signal: AbortSignal.timeout(120000) });
        if (response.ok) {
          writeFileSync(deb, Buffer.from(await response.arrayBuffer()));
          await extractDeb(deb, home);
          rmSync(deb, { force: true });
          const saved = findFontFile(home + "/usr/share/fonts", 0);
          if (saved) {
            fontDir = saved.slice(0, saved.lastIndexOf("/"));
          }
        }
      }
    } catch {
      fontDir = "";
    }
  }
  if (!fontDir) {
    return "";
  }
  const conf = root + "/fonts/fonts.conf";
  mkdirSync(root + "/fonts/cache", { recursive: true });
  writeFileSync(conf, [
    "<?xml version=\"1.0\"?>",
    "<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">",
    "<fontconfig>",
    "  <include ignore_missing=\"yes\">/etc/fonts/fonts.conf</include>",
    "  <dir>" + fontDir + "</dir>",
    "  <cachedir>" + root + "/fonts/cache</cachedir>",
    "</fontconfig>",
    ""
  ].join("\n"));
  return conf;
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

function octalField(bytes) {
  const text = bytes.toString("ascii").replace(/\0.*$/, "").trim();
  if (!text) {
    return 0;
  }
  const value = parseInt(text, 8);
  return Number.isFinite(value) ? value : 0;
}

function pathInside(dest, rel) {
  const root = resolve(dest);
  const full = resolve(root, rel);
  return full === root || full.startsWith(root + sep);
}

export function extractUstar(buffer, dest) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  mkdirSync(dest, { recursive: true });
  let off = 0;
  let pendingName = "";
  while (off + 512 <= bytes.length) {
    const header = bytes.subarray(off, off + 512);
    off += 512;
    if (header.every(function (byte) { return byte === 0; })) {
      break;
    }
    const size = octalField(header.subarray(124, 136));
    if (size > 80 * 1024 * 1024 || off + size > bytes.length + 512) {
      throw new Error("安装包里的文件过大");
    }
    const data = bytes.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    const type = header[156];
    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    let name = pendingName || (prefix ? prefix.replace(/\/$/, "") + "/" + rawName : rawName);
    pendingName = "";
    if (type === 76 || type === 120) {
      pendingName = data.toString("utf8").replace(/\0.*$/, "").trim();
      const pathLine = pendingName.match(/^path=(.*)$/m);
      if (pathLine) {
        pendingName = pathLine[1];
      }
      continue;
    }
    name = name.replace(/^\.\//, "").replace(/\/$/, "");
    if (!name || name.split("/").includes("..") || !pathInside(dest, name)) {
      continue;
    }
    const full = dest + "/" + name;
    if (type === 53) {
      mkdirSync(full, { recursive: true });
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    if (type === 50) {
      const link = header.subarray(157, 257).toString("utf8").replace(/\0.*$/, "");
      if (!link || link.startsWith("/") || link.split("/").includes("..")) {
        continue;
      }
      try {
        unlinkSync(full);
      } catch {
        /* new link */
      }
      symlinkSync(link, full);
      continue;
    }
    if (type === 48 || type === 0) {
      writeFileSync(full, data);
    }
  }
}

function inflateXz(body) {
  const attempts = [
    ["xz", ["-dc"]],
    ["unxz", ["-c"]],
    ["python3", ["-c", "import sys,lzma; sys.stdout.buffer.write(lzma.decompress(sys.stdin.buffer.read()))"]]
  ];
  let last = "没有程序能解开 xz 安装包";
  for (let i = 0; i < attempts.length; i += 1) {
    const result = spawnSync(attempts[i][0], attempts[i][1], { input: body, maxBuffer: 80 * 1024 * 1024 });
    if (result.status === 0 && result.stdout && result.stdout.length) {
      return result.stdout;
    }
    const err = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8").trim() : "";
    if (err) {
      last = err.split("\n").pop().slice(0, 160);
    }
  }
  throw new Error(last);
}

function inflateMember(member) {
  const name = member.name;
  const body = member.body;
  if (name.endsWith(".gz")) {
    return zlib.gunzipSync(body);
  }
  if (name.endsWith(".zst") || name.endsWith(".zstd")) {
    if (typeof zlib.zstdDecompressSync !== "function") {
      throw new Error("这版 Node 解不开 zstd 安装包 " + name);
    }
    return zlib.zstdDecompressSync(body);
  }
  if (name.endsWith(".xz")) {
    return inflateXz(body);
  }
  return body;
}

export function unpackDebBuffer(bytes, dest) {
  const member = debDataTar(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
  if (!member) {
    throw new Error("安装包不是 deb");
  }
  extractUstar(inflateMember(member), dest);
}

async function extractDeb(deb, dest) {
  if (await commandOk("dpkg-deb", ["-x", deb, dest])) {
    return true;
  }
  try {
    unpackDebBuffer(readFileSync(deb), dest);
    return true;
  } catch (error) {
    libraryNote = libraryNote || ("安装包解不开：" + String((error && error.message) || "展开失败").slice(0, 120));
    console.error("jingmai deb", deb, libraryNote);
    return false;
  }
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
      installed = true;
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
  const live = new Set();
  if (current && current.dir) {
    live.add(current.dir);
  }
  if (readerDesk && readerDesk.dir) {
    live.add(readerDesk.dir);
  }
  let names = [];
  try {
    names = readdirSync(tmpdir());
  } catch {
    return;
  }
  const now = Date.now();
  names.forEach(function (name) {
    if (!name.startsWith("shen-jingmai-")) {
      return;
    }
    const dir = tmpdir() + "/" + name;
    if (live.has(dir)) {
      return;
    }
    try {
      if (now - statSync(dir).mtimeMs < 10 * 60 * 1000) {
        return;
      }
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* profile already gone */
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
  for (let round = 0; round < 24; round += 1) {
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

function send(ws, method, params, sessionId, timeoutMs) {
  const id = ws.__seq = (ws.__seq || 0) + 1;
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      ws.removeEventListener("message", onMessage);
      reject(new Error(method + " timeout"));
    }, timeoutMs || 15000);
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

function evaluate(ws, expression, timeoutMs) {
  return send(ws, "Runtime.evaluate", { expression: expression, returnByValue: true, awaitPromise: true }, undefined, timeoutMs).then(function (result) {
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

let loginVisible = false;
let booting = null;
let bootAbort = null;

function stopBooting() {
  if (bootAbort) {
    bootAbort.abort();
    bootAbort = null;
  }
  const chrome = booting;
  booting = null;
  if (!chrome || chrome.exitCode != null) {
    return;
  }
  try {
    chrome.kill("SIGKILL");
  } catch {
    /* already gone */
  }
}

function stopCurrent() {
  stopBooting();
  loginVisible = false;
  shotCache = { at: 0, store: "", image: null, ready: false };
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

export function browserStartFailure() {
  return "服务器浏览器启动失败";
}

function browserAbortError() {
  return Object.assign(new Error("aborted"), { code: "browser" });
}

export function readDebugTargets(url, signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs || 4000);
  const link = signal ? AbortSignal.any([timeout, signal]) : timeout;
  return fetch(url, { signal: link }).then(function (response) {
    if (!response.ok) {
      throw Object.assign(new Error("json"), { code: "browser" });
    }
    return response.json();
  });
}

function browserLaunchError(error) {
  const message = String((error && error.message) || "");
  console.error("jingmai browser", message);
  const wrapped = new Error(message && message !== "aborted" ? message : browserStartFailure());
  wrapped.code = "browser";
  return wrapped;
}

async function launchChrome(signal) {
  if (signal && signal.aborted) {
    throw browserAbortError();
  }
  const host = hostChromePath(findChrome());
  let chromePath = host;
  if (!chromePath) {
    try {
      chromePath = await ensureChrome();
    } catch (error) {
      throw browserLaunchError(error);
    }
  }
  if (!chromePath || (signal && signal.aborted)) {
    throw browserLaunchError(new Error(browserStartFailure()));
  }
  if (host) {
    fontConfig = "";
  } else {
    try {
      fontConfig = await ensureLoginFont();
    } catch {
      fontConfig = "";
    }
  }
  libraryPath = libSearchPath(libHome());
  try {
    return await startChromeProcess(chromePath, signal);
  } catch (error) {
    if (signal && signal.aborted) {
      throw browserAbortError();
    }
    throw browserLaunchError(error);
  }
}

async function startChromeProcess(chromePath, signal) {
  const dir = mkdtempSync(tmpdir() + "/shen-jingmai-");
  const env = Object.assign({}, process.env);
  if (libraryPath) {
    env.LD_LIBRARY_PATH = libraryPath + (env.LD_LIBRARY_PATH ? ":" + env.LD_LIBRARY_PATH : "");
  }
  if (fontConfig) {
    env.FONTCONFIG_FILE = fontConfig;
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
  ], { env: env, stdio: ["ignore", "pipe", "pipe"] });
  booting = chrome;
  const controller = new AbortController();
  bootAbort = controller;
  const linked = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  try {
    let buf = "";
    const port = await new Promise(function (resolve, reject) {
      let settled = false;
      function finish(error, value) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (error) {
          reject(error);
          return;
        }
        resolve(value);
      }
      const timer = setTimeout(function () {
        finish(Object.assign(new Error(browserFailure(buf)), { code: "browser" }));
      }, 20000);
      if (linked.aborted) {
        finish(browserAbortError());
        return;
      }
      linked.addEventListener("abort", function () {
        finish(browserAbortError());
      }, { once: true });
      chrome.on("error", function () {
        finish(Object.assign(new Error(browserFailure(buf || "spawn")), { code: "browser" }));
      });
      function takeChunk(chunk) {
        buf = (buf + chunk.toString()).slice(-4000);
        const match = buf.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|\[::1\]):(\d+)\//);
        if (match) {
          finish(null, Number(match[1]));
        }
      }
      chrome.stdout.on("data", takeChunk);
      chrome.stderr.on("data", takeChunk);
      chrome.on("exit", function () {
        finish(Object.assign(new Error(browserFailure(buf)), { code: "browser" }));
      });
    });
    const list = await readDebugTargets("http://127.0.0.1:" + port + "/json/list", linked, 30000);
    const page = Array.isArray(list) ? list.find(function (item) {
      return item.type === "page";
    }) : null;
    if (!page || !page.webSocketDebuggerUrl) {
      throw Object.assign(new Error("json"), { code: "browser" });
    }
    const ws = await connectSocket(page.webSocketDebuggerUrl);
    if (booting === chrome) {
      booting = null;
    }
    if (bootAbort === controller) {
      bootAbort = null;
    }
    return { chrome: chrome, dir: dir, ws: ws, port: port, password: "" };
  } catch (error) {
    if (booting === chrome) {
      booting = null;
    }
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

export function collectFrameIds(tree) {
  const ids = [];
  function walk(node) {
    if (!node) {
      return;
    }
    if (node.frame && node.frame.id) {
      ids.push(node.frame.id);
    }
    (node.childFrames || []).forEach(walk);
  }
  walk(tree && tree.frameTree);
  return ids.slice(0, 6);
}

export function sessionReady(href, cookies) {
  if (!hasSession(cookies || [])) {
    return false;
  }
  return !/passport\.|\/login/i.test(String(href || ""));
}

async function pageText(ws) {
  const text = await evaluate(ws, "document.body ? document.body.innerText.slice(0, 500) : ''");
  return String(text || "");
}

export function deskUsable(desk) {
  return Boolean(
    desk &&
    desk.ws &&
    desk.ws.readyState === 1 &&
    desk.chrome &&
    desk.chrome.exitCode == null &&
    desk.chrome.killed !== true
  );
}

export const LOGIN_SCREEN_MESSAGE = "请在下面的服务器画面里完成验证。点画面就是在服务器上操作。";

export const PAGE_WAIT_MESSAGE = "正在等京麦页面刷新出来";

const LOGIN_PAGE_EXPR = `(() => {
  function shown(el) {
    if (!el) return false;
    const box = el.getBoundingClientRect();
    return box.width > 20 && box.height > 10;
  }
  const inputs = [...document.querySelectorAll("input")];
  const account = inputs.find((node) => (node.placeholder || "").includes("账号"));
  const password = inputs.find((node) => (node.placeholder || "").includes("密码"));
  return {
    readyState: document.readyState,
    href: location.href,
    accountVisible: shown(account),
    passwordVisible: shown(password),
    text: document.body ? document.body.innerText.slice(0, 300) : ""
  };
})()`;

export function loginPageVisible(page) {
  if (!page) {
    return false;
  }
  const href = String(page.href || "");
  if (!href || href === "about:blank" || href.startsWith("about:")) {
    return false;
  }
  if (page.accountVisible || page.passwordVisible) {
    return true;
  }
  return /登录|账号|密码|验证码|安全验证|滑块|扫码/.test(String(page.text || ""));
}

export function loginPageSettled(page) {
  if (!loginPageVisible(page) || page.readyState === "loading") {
    return false;
  }
  if (page.accountVisible && page.passwordVisible) {
    return true;
  }
  return /滑块|验证码|安全验证|扫码登录/.test(String(page.text || ""));
}

export function loginOpenReady(attempt, screen, hasCookie) {
  if (hasCookie) {
    return "ok";
  }
  if (screen && screen.status === "login") {
    return "login";
  }
  if (screen && screen.settled) {
    return "show";
  }
  return "wait";
}

export function loginScreenState(text, formReady) {
  const source = String(text || "");
  if (/滑块|验证码|安全验证|请完成验证|扫码/.test(source)) {
    return { status: "verify", message: LOGIN_SCREEN_MESSAGE };
  }
  if (source.includes("不匹配") || source.includes("密码不正确") || source.includes("账号或密码不正确") || source.includes("账号或密码错误")) {
    return { status: "login", message: "账号或密码不正确" };
  }
  if (source.includes("冻结") || source.includes("停用")) {
    return { status: "login", message: "这个账号现在不能登录" };
  }
  if (!formReady && /登录异常|登录环境异常|暂时无法登录/.test(source)) {
    return { status: "verify", message: "京麦拒绝了这次服务器登录，请过一会儿再试" };
  }
  return { status: "verify", message: formReady ? LOGIN_SCREEN_MESSAGE : "" };
}

async function readScreenState(ws) {
  const formReady = Boolean(
    await evaluate(ws, "!![...document.querySelectorAll('input')].find((node) => (node.placeholder || '').includes('账号'))")
  );
  const state = loginScreenState(await pageText(ws), formReady);
  state.formReady = formReady;
  return state;
}

async function loginSurfaceReady(ws) {
  try {
    const form = await evaluate(ws, "!![...document.querySelectorAll('input')].find((node) => { const p = node.placeholder || ''; return p.includes('账号') || p.includes('验证码'); })");
    if (form) {
      return true;
    }
    const text = await pageText(ws);
    return /滑块|验证码|安全验证|扫码登录/.test(String(text || ""));
  } catch {
    return false;
  }
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

async function acquireDesk(store, ticket, signal) {
  if (ticket != null && ticket !== openTicket) {
    return null;
  }
  if (signal && signal.aborted) {
    return null;
  }
  if (deskUsable(current)) {
    current.store = store;
    current.password = "";
    try {
      await send(current.ws, "Network.clearBrowserCookies", {}, undefined, 2000);
      return current;
    } catch {
      stopCurrent();
    }
  }
  if ((ticket != null && ticket !== openTicket) || (signal && signal.aborted)) {
    return null;
  }
  const desk = await launchChrome(signal);
  if ((ticket != null && ticket !== openTicket) || (signal && signal.aborted)) {
    discard(desk);
    return null;
  }
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
  return desk;
}

export async function closeDesk() {
  openTicket += 1;
  if (!deskUsable(current)) {
    stopCurrent();
    return;
  }
  const desk = current;
  desk.store = "";
  desk.password = "";
  try {
    await send(desk.ws, "Network.clearBrowserCookies", {}, undefined, 2000);
    await send(desk.ws, "Page.navigate", { url: "about:blank" }, undefined, 2000);
  } catch {
    stopCurrent();
  }
}

async function readLoginPage(ws) {
  try {
    return await evaluate(ws, LOGIN_PAGE_EXPR, 2500);
  } catch {
    return null;
  }
}

async function finishOpen(desk, loginName, password, ticket) {
  try {
    let streak = 0;
    let sawPage = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (ticket !== openTicket || current !== desk) {
        return { status: "login", message: "登录已取消" };
      }
      await sleep(700);
      const page = await readLoginPage(desk.ws);
      if (loginPageVisible(page)) {
        loginVisible = true;
        sawPage = true;
      }
      if (loginPageSettled(page)) {
        streak += 1;
        if (streak >= 2) {
          break;
        }
      } else {
        streak = 0;
      }
    }
    if (ticket !== openTicket || current !== desk) {
      return { status: "login", message: "登录已取消" };
    }
    if (streak >= 2) {
      await fillAndSubmit(desk.ws, loginName, password);
    }
    password = "";
    loginVisible = sawPage || loginVisible;
    if (!loginVisible) {
      if (ticket === openTicket) {
        stopCurrent();
      }
      return { status: "login", message: "登录页还没刷新出来" };
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (ticket !== openTicket || current !== desk) {
        return { status: "login", message: "登录已取消" };
      }
      let cookies = [];
      let href = "";
      try {
        cookies = await readCookies(desk.ws);
        href = String(await evaluate(desk.ws, "location.href", 2500) || "");
      } catch {
        cookies = [];
        href = "";
      }
      if (sessionReady(href, cookies)) {
        return { status: "ok", cookies: cookies };
      }
      const page = await readLoginPage(desk.ws);
      if (loginPageVisible(page)) {
        loginVisible = true;
      }
      const screen = loginScreenState(page && page.text, Boolean(page && page.accountVisible));
      if (screen.status === "login") {
        return screen;
      }
      await sleep(700);
    }
    return { status: "verify", message: LOGIN_SCREEN_MESSAGE, formReady: true };
  } finally {
    password = "";
  }
}

export async function openDesk({ store, loginName, password, reveal, onStep } = {}) {
  const ticket = ++openTicket;
  const step = function (message) {
    if (message && typeof onStep === "function") {
      onStep(message);
    }
  };
  let desk = null;
  let launchTimedOut = false;
  let launchTimer = null;
  try {
    loginVisible = false;
    shotCache = { at: 0, store: "", image: null, ready: false };
    step("正在启动浏览器");
    const launching = acquireDesk(store, ticket);
    launching.catch(function () {});
    desk = await Promise.race([
      launching,
      new Promise(function (_resolve, reject) {
        launchTimer = setTimeout(function () {
          launchTimedOut = true;
          stopBooting();
          reject(browserAbortError());
        }, 50000);
      })
    ]);
    if (!desk || ticket !== openTicket || launchTimedOut) {
      if (desk && desk !== current) {
        discard(desk);
      }
      if (ticket === openTicket) {
        openTicket += 1;
      }
      return { status: "login", message: launchTimedOut ? browserStartFailure() : "登录已取消" };
    }
    step("正在打开登录页");
    try {
      await send(desk.ws, "Page.navigate", { url: LOGIN_URL }, undefined, 20000);
    } catch (error) {
      if (!String(error && error.message || "").includes("timeout")) {
        throw error;
      }
    }
    const account = loginName;
    const secret = password;
    password = "";
    return await finishOpen(desk, account, secret, ticket);
  } catch (error) {
    if (ticket === openTicket) {
      stopCurrent();
    }
    if (ticket === openTicket && (launchTimedOut || (error && error.code === "browser"))) {
      openTicket += 1;
    }
    if (error && (error.code === "browser" || launchTimedOut)) {
      console.error("jingmai browser", error.message);
      const detail = error && error.message && error.message !== "aborted" ? error.message : "";
      return { status: "login", message: detail || browserStartFailure() };
    }
    if (String(error && error.message || "").includes("timeout")) {
      return { status: "login", message: "登录页没有在 8 秒内打开" };
    }
    return { status: "login", message: "服务器登录没有打开" };
  } finally {
    clearTimeout(launchTimer);
    password = "";
    if (desk) {
      desk.password = "";
    }
  }
}

export async function pollDesk(store) {
  if (!current || current.store !== store || !current.ws || current.ws.readyState !== 1) {
    return { status: "opening", message: "正在启动浏览器" };
  }
  try {
    const cookies = await readCookies(current.ws);
    const href = await evaluate(current.ws, "location.href");
    if (sessionReady(href, cookies)) {
      return { status: "ok", cookies: cookies };
    }
    if (!loginVisible) {
      return { status: "opening", message: PAGE_WAIT_MESSAGE };
    }
  } catch {
    return { status: "opening", message: PAGE_WAIT_MESSAGE };
  }
  return { status: "verify", message: LOGIN_SCREEN_MESSAGE };
}

let shotCache = { at: 0, store: "", image: null, ready: false };
let shotTask = null;
let shotHold = 0;

function holdShots(ms) {
  shotHold = Date.now() + ms;
}

export async function shotDesk(store) {
  if (!current || current.store !== store || !current.ws) {
    return null;
  }
  const now = Date.now();
  if (shotCache.ready && shotCache.store === store && shotCache.image && (now - shotCache.at < 1600 || now < shotHold)) {
    return shotCache.image;
  }
  if (shotTask) {
    return shotTask;
  }
  shotTask = captureShot(store).finally(function () {
    shotTask = null;
  });
  return shotTask;
}

async function captureShot(store) {
  if (!current || current.store !== store || !current.ws || current.ws.readyState !== 1) {
    return shotCache.ready && shotCache.store === store ? shotCache.image : null;
  }
  if (!loginVisible) {
    return shotCache.ready && shotCache.store === store ? shotCache.image : null;
  }
  try {
    const shot = await send(current.ws, "Page.captureScreenshot", { format: "jpeg", quality: 60 }, undefined, 4000);
    const image = Buffer.from(shot.data || "", "base64");
    if (!image.length) {
      return shotCache.ready && shotCache.store === store ? shotCache.image : null;
    }
    shotCache = { at: Date.now(), store: store, image: image, ready: true };
    return image;
  } catch {
    return shotCache.ready && shotCache.store === store ? shotCache.image : null;
  }
}

export function loginPageAction(doc, action) {
  function textOf(node) {
    return String((node && (node.innerText || node.value || node.textContent)) || "").replace(/\s+/g, "");
  }
  function visible(node) {
    if (!node || !node.getBoundingClientRect) {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }
  function isConfirm(node) {
    const text = textOf(node);
    if (!text || text.length > 12 || /获取|发送|重新|取消|关闭/.test(text)) {
      return false;
    }
    return /确定|提交|确认|完成/.test(text) || text === "验证";
  }
  function docsOf(root) {
    const docs = [];
    function add(item) {
      if (!item || docs.indexOf(item) !== -1) {
        return;
      }
      docs.push(item);
      const frames = item.querySelectorAll ? item.querySelectorAll("iframe") : [];
      for (let i = 0; i < frames.length; i += 1) {
        try {
          add(frames[i].contentDocument);
        } catch {
          /* the captcha frame is not readable from here */
        }
      }
    }
    add(root);
    return docs;
  }
  function topBox(node) {
    const rect = node.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    let view = node.ownerDocument;
    for (let depth = 0; depth < 5 && view && view.defaultView && view.defaultView.frameElement; depth += 1) {
      const frame = view.defaultView.frameElement;
      const frameBox = frame.getBoundingClientRect();
      left += frameBox.left;
      top += frameBox.top;
      view = frame.ownerDocument;
    }
    return {
      left: left,
      top: top,
      width: rect.width,
      height: rect.height,
      cx: left + rect.width / 2,
      cy: top + rect.height / 2
    };
  }
  function pointOf(node, fallbackX, fallbackY, kind) {
    if (!node || !node.getBoundingClientRect) {
      return { kind: kind || "point", x: Math.round(fallbackX), y: Math.round(fallbackY) };
    }
    const box = topBox(node);
    return { kind: kind || "button", x: Math.round(box.cx), y: Math.round(box.cy) };
  }
  function elementAt(root, x, y) {
    let current = root;
    let localX = x;
    let localY = y;
    let el = null;
    for (let depth = 0; depth < 5; depth += 1) {
      if (!current || !current.elementFromPoint) {
        break;
      }
      el = current.elementFromPoint(localX, localY);
      if (!el || String(el.tagName || "").toUpperCase() !== "IFRAME") {
        break;
      }
      const rect = el.getBoundingClientRect();
      let inner = null;
      try {
        inner = el.contentDocument;
      } catch {
        inner = null;
      }
      if (!inner || !inner.elementFromPoint) {
        break;
      }
      localX -= rect.left;
      localY -= rect.top;
      current = inner;
    }
    return el;
  }
  function clickable(el) {
    let node = el;
    for (let i = 0; node && i < 6; i += 1) {
      const tag = String(node.tagName || "").toUpperCase();
      const role = node.getAttribute ? String(node.getAttribute("role") || "") : "";
      const type = String(node.type || "").toLowerCase();
      if ((tag === "BUTTON" || tag === "A" || role === "button" || type === "button" || type === "submit" || isConfirm(node)) && visible(node)) {
        return node;
      }
      node = node.parentElement || null;
    }
    return null;
  }
  function nearConfirm(root, x, y) {
    let best = null;
    let bestDist = 20;
    docsOf(root).forEach(function (item) {
      const nodes = item.querySelectorAll ? item.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit]") : [];
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!visible(node) || !isConfirm(node)) {
          continue;
        }
        const box = topBox(node);
        const dx = Math.max(box.left - x, 0, x - (box.left + box.width));
        const dy = Math.max(box.top - y, 0, y - (box.top + box.height));
        const dist = Math.hypot(dx, dy);
        if (dist <= bestDist) {
          best = node;
          bestDist = dist;
        }
      }
    });
    return best;
  }
  function confirmAround(input) {
    let node = input && input.parentElement;
    for (let depth = 0; node && depth < 4; depth += 1) {
      const nodes = node.querySelectorAll ? node.querySelectorAll("button, a, [role=button], input[type=button], input[type=submit], div, span") : [];
      const limit = Math.min(nodes.length, 40);
      for (let i = 0; i < limit; i += 1) {
        if (nodes[i] !== input && visible(nodes[i]) && isConfirm(nodes[i])) {
          return nodes[i];
        }
      }
      node = node.parentElement;
    }
    return null;
  }
  function loginSubmit(root) {
    let found = null;
    docsOf(root).forEach(function (item) {
      const nodes = item.querySelectorAll ? item.querySelectorAll("button, [role=button], input[type=submit]") : [];
      const limit = Math.min(nodes.length, 40);
      for (let i = 0; i < limit; i += 1) {
        const text = textOf(nodes[i]);
        if (!visible(nodes[i]) || (text !== "登录" && text !== "立即登录")) {
          continue;
        }
        found = nodes[i];
      }
    });
    return found;
  }
  if (action && action.submit) {
    const button = loginSubmit(doc);
    if (!button) {
      return { kind: "none", x: 0, y: 0 };
    }
    return pointOf(button, 0, 0, "button");
  }
  if (action && action.text) {
    const value = String(action.text).slice(0, 20);
    let input = null;
    let plain = null;
    let plainCount = 0;
    let sawAccount = false;
    docsOf(doc).forEach(function (item) {
      const fields = item.querySelectorAll ? item.querySelectorAll("input, textarea") : [];
      for (let i = 0; i < fields.length; i += 1) {
        const field = fields[i];
        const tag = String(field.tagName || "").toUpperCase();
        if (tag && tag !== "INPUT" && tag !== "TEXTAREA") {
          continue;
        }
        const hint = String(field.placeholder || "") + String(field.name || "") + String(field.getAttribute ? field.getAttribute("aria-label") || "" : "");
        if (!visible(field)) {
          continue;
        }
        if (/账号|密码/.test(hint) && !/验证码/.test(hint)) {
          sawAccount = true;
          continue;
        }
        plain = field;
        plainCount += 1;
        if (/验证码|校验码|短信/.test(hint)) {
          input = field;
        }
      }
    });
    if (!input && !sawAccount && plainCount === 1) {
      input = plain;
    }
    if (!input) {
      return { kind: "no-input", x: 0, y: 0 };
    }
    if (input.focus) {
      input.focus();
    }
    try {
      const view = input.ownerDocument && input.ownerDocument.defaultView;
      const proto = view && view.HTMLInputElement && Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value");
      if (proto && proto.set) {
        proto.set.call(input, value);
      } else {
        input.value = value;
      }
      if (view && view.Event && input.dispatchEvent) {
        input.dispatchEvent(new view.Event("input", { bubbles: true }));
        input.dispatchEvent(new view.Event("change", { bubbles: true }));
      }
    } catch {
      input.value = value;
    }
    const button = confirmAround(input) || loginSubmit(doc);
    if (!button) {
      return { kind: "typed", x: 0, y: 0 };
    }
    if (button.click) {
      button.click();
    }
    return pointOf(button, 0, 0, "button");
  }
  const rawX = Number(action && action.x) || 0;
  const rawY = Number(action && action.y) || 0;
  const hit = clickable(elementAt(doc, rawX, rawY)) || nearConfirm(doc, rawX, rawY);
  if (!hit) {
    return { kind: "point", x: Math.round(rawX), y: Math.round(rawY) };
  }
  return pointOf(hit, rawX, rawY, "button");
}

async function cssPoint(ws, x, y, image) {
  let px = Number(x) || 0;
  let py = Number(y) || 0;
  const iw = image && Number(image.width);
  const ih = image && Number(image.height);
  if (!(iw > 0 && ih > 0)) {
    return { x: px, y: py };
  }
  try {
    const metrics = await send(ws, "Page.getLayoutMetrics");
    const view = (metrics && (metrics.cssVisualViewport || metrics.cssLayoutViewport)) || {};
    const vw = Number(view.clientWidth || view.width) || 0;
    const vh = Number(view.clientHeight || view.height) || 0;
    if (vw > 0 && vh > 0 && (Math.abs(iw - vw) > 1 || Math.abs(ih - vh) > 1)) {
      px = px * vw / iw;
      py = py * vh / ih;
    }
  } catch {
    /* keep the point from the picture */
  }
  return { x: px, y: py };
}

async function pressLoginButton(ws, hit) {
  if (!hit || hit.x == null || hit.y == null) {
    return;
  }
  holdShots(900);
  await mouseClick(ws, hit.x, hit.y);
}

async function mouseClick(ws, x, y, sessionId) {
  const point = {
    x: Math.max(0, Math.round(Number(x) || 0)),
    y: Math.max(0, Math.round(Number(y) || 0)),
    button: "left",
    clickCount: 1
  };
  await send(ws, "Input.dispatchMouseEvent", Object.assign({ type: "mouseMoved", buttons: 0 }, point), sessionId);
  await send(ws, "Input.dispatchMouseEvent", Object.assign({ type: "mousePressed", buttons: 1 }, point), sessionId);
  await sleep(80);
  await send(ws, "Input.dispatchMouseEvent", Object.assign({ type: "mouseReleased", buttons: 0 }, point), sessionId);
}

export async function clickDesk(store, x, y, image) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  holdShots(900);
  const point = await cssPoint(current.ws, x, y, image);
  let aim = { kind: "point", x: point.x, y: point.y };
  try {
    const hit = await evaluate(current.ws, `(${loginPageAction.toString()})(document, ${JSON.stringify({ x: point.x, y: point.y })})`);
    if (hit && hit.x != null) {
      aim = hit;
    }
  } catch {
    aim = { kind: "point", x: point.x, y: point.y };
  }
  await mouseClick(current.ws, aim.x, aim.y);
}

async function frameIds(ws) {
  try {
    const tree = await send(ws, "Page.getFrameTree", {}, undefined, 2500);
    const ids = collectFrameIds(tree);
    return ids.length ? ids : [""];
  } catch {
    return [""];
  }
}

export async function typeDesk(store, text) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  const value = String(text || "").slice(0, 20);
  if (!value) {
    return;
  }
  const expression = `(${loginPageAction.toString()})(document, ${JSON.stringify({ text: value })})`;
  let typed = false;
  const frames = await frameIds(current.ws);
  for (let i = 0; i < frames.length; i += 1) {
    try {
      let contextId = 0;
      if (frames[i]) {
        const world = await send(current.ws, "Page.createIsolatedWorld", { frameId: frames[i], grantUniveralAccess: true }, undefined, 2500);
        contextId = world.executionContextId || 0;
      }
      const result = contextId
        ? await send(current.ws, "Runtime.evaluate", { expression: expression, contextId: contextId, returnByValue: true }, undefined, 2500)
        : await send(current.ws, "Runtime.evaluate", { expression: expression, returnByValue: true }, undefined, 2500);
      const hit = result && result.result ? result.result.value : null;
      if (hit && hit.kind === "button") {
        await pressLoginButton(current.ws, hit);
        return;
      }
      if (hit && hit.kind === "typed") {
        typed = true;
      }
    } catch {
      /* try the next frame */
    }
  }
  if (typed) {
    try {
      const submit = `(${loginPageAction.toString()})(document, ${JSON.stringify({ submit: true })})`;
      const result = await send(current.ws, "Runtime.evaluate", { expression: submit, returnByValue: true }, undefined, 2500);
      const hit = result && result.result ? result.result.value : null;
      if (hit && hit.kind === "button") {
        await pressLoginButton(current.ws, hit);
        return;
      }
    } catch {
      /* the login button stays for the next poll */
    }
  }
  if (!typed) {
    try {
      await send(current.ws, "Input.insertText", { text: value }, undefined, 2500);
    } catch {
      /* the field was not focused */
    }
  }
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
