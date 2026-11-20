"""Persistent Chromium session that calls the page's own query function."""

from __future__ import annotations

import asyncio
from pathlib import Path

from hejun_reader.resolve import ResolveError, resolve_in_modules
from hejun_reader.store import SnapshotStore

CALL_JS = """
async ({ moduleUrl, exportName, params }) => {
  let mod;
  try {
    mod = await import(moduleUrl);
  } catch (error) {
    throw new Error("import 失败：" + (error && error.message ? error.message : error));
  }
  const fn = mod[exportName];
  if (typeof fn !== "function") {
    throw new Error("导出 " + exportName + " 不是函数");
  }
  let result = await fn(params);
  if (result && typeof result === "object" && result.config && result.headers && Object.prototype.hasOwnProperty.call(result, "data")) {
    result = result.data;
  }
  if (result === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    throw new Error("查询结果不能转成 JSON");
  }
}
"""

MODULE_URLS_JS = """
() => {
  const urls = new Set();
  for (const script of document.scripts) {
    if (script.src) urls.add(script.src.split("#")[0]);
  }
  for (const entry of performance.getEntriesByType("resource")) {
    const name = String(entry.name || "").split("#")[0];
    if (name.split("?")[0].endsWith(".js")) urls.add(name.split("?")[0]);
  }
  return [...urls];
}
"""

AUTH_JS = """
(origin) => {
  const node = document.documentElement;
  if (node && node.dataset.hejunAuth === "1") return true;
  if (node && node.dataset.hejunAuth === "0") return false;
  const path = location.pathname || "";
  if (path.includes("login")) return false;
  const text = ((document.body && document.body.innerText) || "").slice(0, 800);
  if (text.includes("请用微信扫") || text.includes("扫码登录")) return false;
  return String(location.href || "").startsWith(origin);
}
"""


class NeedsLogin(Exception):
    pass


class HejunBrowser:
    def __init__(self, profile_dir: Path, origin: str, headless: bool = True):
        self.profile_dir = Path(profile_dir)
        self.origin = origin.rstrip("/")
        self.headless = headless
        self.store = SnapshotStore(self.profile_dir / "snapshots")
        self._playwright = None
        self._context = None
        self._page = None
        self._lock = asyncio.Lock()
        self._signature: tuple[str, ...] = ()
        self._modules: list[tuple[str, str]] = []

    async def start(self):
        from playwright.async_api import async_playwright

        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self._playwright = await async_playwright().start()
        self._context = await self._playwright.chromium.launch_persistent_context(
            str(self.profile_dir / "chromium"),
            headless=self.headless,
            viewport={"width": 1280, "height": 900},
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()

    async def stop(self):
        if self._context is not None:
            await self._context.close()
        if self._playwright is not None:
            await self._playwright.stop()
        self._context = None
        self._playwright = None
        self._page = None

    async def open_app(self, path: str = "/"):
        target = path if path.startswith("http") else self.origin + (path if path.startswith("/") else "/" + path)
        await self._page.goto(target, wait_until="domcontentloaded")
        await self._page.wait_for_timeout(300)
        self._signature = ()

    async def logged_in(self) -> bool:
        if self._page is None or self._page.url in ("", "about:blank"):
            return False
        return bool(await self._page.evaluate(AUTH_JS, self.origin))

    async def _module_urls(self) -> list[str]:
        urls = await self._page.evaluate(MODULE_URLS_JS)
        origin = self.origin
        same = []
        for url in urls:
            if isinstance(url, str) and url.startswith(origin) and url.split("?")[0].endswith(".js"):
                same.append(url.split("?")[0])
        return sorted(set(same))

    async def _load_modules(self) -> list[tuple[str, str]]:
        urls = await self._module_urls()
        signature = tuple(urls)
        if signature == self._signature and self._modules:
            return self._modules
        modules = []
        for url in urls:
            text = await self._page.evaluate(
                """async (url) => {
                  const response = await fetch(url, { credentials: "include", cache: "no-store" });
                  if (!response.ok) return "";
                  return await response.text();
                }""",
                url,
            )
            if text:
                modules.append((url, text))
        self._signature = signature
        self._modules = modules
        return modules

    async def resolve(self, api_path: str):
        modules = await self._load_modules()
        return resolve_in_modules(modules, api_path)

    async def query(self, api_path: str, params: dict, *, entry: str = "/"):
        async with self._lock:
            if self._page is None:
                raise RuntimeError("浏览器还没启动")
            if self._page.url in ("", "about:blank") or not str(self._page.url).startswith(self.origin):
                await self.open_app(entry)
            if not await self.logged_in():
                raise NeedsLogin("浏览器里还没有禾君 BI 登录态。先用同一个 profile 扫码登录。")
            try:
                resolved = await self.resolve(api_path)
                payload = await self._call(resolved, params)
            except ResolveError:
                raise
            except Exception:
                self._signature = ()
                resolved = await self.resolve(api_path)
                payload = await self._call(resolved, params)
            self.store.save(api_path, params, payload, resolved)
            return {"payload": payload, "export_name": resolved.export_name, "module_url": resolved.module_url, "local_name": resolved.local_name}

    async def _call(self, resolved, params):
        return await self._page.evaluate(
            CALL_JS,
            {"moduleUrl": resolved.module_url, "exportName": resolved.export_name, "params": params},
        )

    async def page_text(self) -> str:
        return await self._page.evaluate("() => (document.body && document.body.innerText) || ''")
