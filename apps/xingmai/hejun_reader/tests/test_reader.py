import asyncio
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from hejun_reader.browser import HejunBrowser
from hejun_reader.resolve import ResolveError
from hejun_reader.server import ReaderServer, request_line

PATH = "/v2/channel/channelOverViewList"
PARAMS = {"startDate": "2026-11-12", "endDate": "2026-11-18", "daysType": "7"}

API_V1 = """
function post(url, body) {
  return Promise.resolve({ code: 0, data: { list: [{ shopName: "甲店", payAmount: 700 }] }, content: "ok", url, echo: body });
}
function bv(e, t) { return post(`/v2/channel/channelOverViewList`, e); }
export { bv as tn };
"""

INDEX_V1 = """
import { tn } from "./api-v1.js";
const data = await tn({ startDate: "2026-11-12", endDate: "2026-11-18", daysType: "7" });
document.querySelector("#pay").textContent = String(data.data.list[0].payAmount);
document.documentElement.dataset.hejunAuth = "1";
"""

API_V2 = """
function post(url, body) {
  return Promise.resolve({ code: 0, data: { list: [{ shopName: "甲店", payAmount: 800 }] }, content: "ok", url, echo: body });
}
function zz(e, t) { return post(`/v2/channel/channelOverViewList`, e); }
export { zz as q9 };
"""

INDEX_V2 = """
import { q9 } from "./api-v2.js";
const data = await q9({ startDate: "2026-11-12", endDate: "2026-11-18", daysType: "7" });
document.querySelector("#pay").textContent = String(data.data.list[0].payAmount);
document.documentElement.dataset.hejunAuth = "1";
"""

API_V3 = """
export function unused() { return 1; }
"""

INDEX_V3 = """
import { unused } from "./api-v3.js";
unused();
document.querySelector("#pay").textContent = "没有查询函数";
document.documentElement.dataset.hejunAuth = "1";
"""

PAGE = """
<!doctype html>
<html data-hejun-auth="1">
<body>
<p>支付金额 <span id="pay">...</span></p>
<script type="module" src="__SRC__"></script>
</body>
</html>
"""


class Site:
    def __init__(self):
        self.version = "v1"
        handler = self._handler()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def origin(self):
        host, port = self.httpd.server_address
        return f"http://{host}:{port}"

    def stop(self):
        self.httpd.shutdown()
        self.thread.join(timeout=3)

    def _handler(self):
        site = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                version = site.version
                routes = {
                    "/": PAGE.replace("__SRC__", f"/static/js/index-{version}.js"),
                    "/static/js/index-v1.js": INDEX_V1,
                    "/static/js/api-v1.js": API_V1,
                    "/static/js/index-v2.js": INDEX_V2,
                    "/static/js/api-v2.js": API_V2,
                    "/static/js/index-v3.js": INDEX_V3,
                    "/static/js/api-v3.js": API_V3,
                }
                body = routes.get(self.path.split("?")[0])
                if body is None:
                    self.send_error(404)
                    return
                kind = "text/html; charset=utf-8" if self.path.split("?")[0] == "/" else "text/javascript; charset=utf-8"
                data = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", kind)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, format, *args):
                return

        return Handler


class ReaderTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.site = Site()
        self.tmp = TemporaryDirectory()
        self.profile = Path(self.tmp.name)
        self.browser = HejunBrowser(self.profile, self.site.origin, headless=True)
        await self.browser.start()

    async def asyncTearDown(self):
        await self.browser.stop()
        self.site.stop()
        self.tmp.cleanup()

    async def _shown_amount(self):
        await self.browser._page.wait_for_function("() => document.querySelector('#pay').textContent !== '...'")
        return (await self.browser._page.text_content("#pay")).strip()

    async def test_same_query_matches_the_page_and_a_new_bundle_is_found_again(self):
        await self.browser.open_app("/")
        shown = await self._shown_amount()
        result = await self.browser.query(PATH, PARAMS)
        self.assertEqual(shown, "700")
        self.assertEqual(result["payload"]["data"]["list"][0]["payAmount"], 700)
        self.assertEqual(result["export_name"], "tn")
        self.assertEqual(result["payload"]["echo"], PARAMS)
        first_file = self.browser.store.file_for(PATH, PARAMS)
        first_bytes = first_file.read_bytes()

        self.site.version = "v3"
        await self.browser.open_app("/")
        await self._shown_amount()
        with self.assertRaises(ResolveError) as caught:
            await self.browser.query(PATH, PARAMS)
        self.assertEqual(caught.exception.code, "not_found")
        self.assertEqual(first_file.read_bytes(), first_bytes)

        self.site.version = "v2"
        await self.browser.open_app("/")
        shown = await self._shown_amount()
        result = await self.browser.query(PATH, PARAMS)
        self.assertEqual(shown, "800")
        self.assertEqual(result["payload"]["data"]["list"][0]["payAmount"], 800)
        self.assertEqual(result["export_name"], "q9")
        self.assertNotEqual(first_file.read_bytes(), first_bytes)

    async def test_socket_reuses_the_browser_profile(self):
        socket_path = self.profile / "reader.sock"
        server = ReaderServer(self.browser, socket_path)
        await self.browser.open_app("/")
        await server.start()
        task = asyncio.create_task(server.serve_forever())
        try:
            fresh = HejunBrowser(self.profile, self.site.origin, headless=True)
            self.assertTrue((self.profile / "chromium").exists())
            response = await asyncio.to_thread(
                request_line,
                socket_path,
                {"id": "1", "op": "query", "path": PATH, "params": PARAMS},
            )
            self.assertTrue(response["ok"], response)
            self.assertEqual(response["payload"]["data"]["list"][0]["payAmount"], 700)
            self.site.version = "v3"
            reload = await asyncio.to_thread(request_line, socket_path, {"id": "2", "op": "reload"})
            self.assertTrue(reload["ok"])
            failed = await asyncio.to_thread(
                request_line,
                socket_path,
                {"id": "3", "op": "query", "path": PATH, "params": PARAMS},
            )
            self.assertFalse(failed["ok"])
            self.assertEqual(failed["code"], "not_found")
            self.assertTrue(failed["kept"])
            self.assertEqual(failed["previous"]["payload"]["data"]["list"][0]["payAmount"], 700)
            saved = json.loads(self.browser.store.file_for(PATH, PARAMS).read_text(encoding="utf-8"))
            self.assertEqual(saved["payload"]["data"]["list"][0]["payAmount"], 700)
            self.assertIsNotNone(fresh)
        finally:
            task.cancel()
            await server.stop()


if __name__ == "__main__":
    unittest.main()
