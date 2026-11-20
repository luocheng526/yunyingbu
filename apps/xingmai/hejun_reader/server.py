"""Unix socket front for the long-lived browser reader."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from hejun_reader.browser import HejunBrowser, NeedsLogin
from hejun_reader.resolve import ResolveError


class ReaderServer:
    def __init__(self, browser: HejunBrowser, socket_path: Path):
        self.browser = browser
        self.socket_path = Path(socket_path)
        self._server = None

    async def start(self):
        if self.socket_path.exists():
            self.socket_path.unlink()
        self.socket_path.parent.mkdir(parents=True, exist_ok=True)
        self._server = await asyncio.start_unix_server(self._handle, path=str(self.socket_path))
        os.chmod(self.socket_path, 0o600)

    async def serve_forever(self):
        async with self._server:
            await self._server.serve_forever()

    async def stop(self):
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
        if self.socket_path.exists():
            self.socket_path.unlink()

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            raw = await reader.readline()
            if len(raw) > 2_000_000:
                response = {"ok": False, "error": "请求过大"}
            else:
                try:
                    message = json.loads(raw.decode("utf-8") or "{}")
                except json.JSONDecodeError:
                    message = None
                response = {"ok": False, "error": "请求不是 JSON"} if message is None else await self._dispatch(message)
        except Exception as exc:
            response = {"ok": False, "error": str(exc), "kept": True}
        writer.write((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def _dispatch(self, message: dict) -> dict:
        op = message.get("op")
        request_id = message.get("id")
        if op == "status":
            logged = False
            try:
                logged = await self.browser.logged_in()
            except Exception:
                logged = False
            return {"ok": True, "id": request_id, "logged_in": logged, "origin": self.browser.origin}
        if op == "reload":
            self.browser._signature = ()
            await self.browser.open_app(message.get("entry") or "/")
            return {"ok": True, "id": request_id}
        if op != "query":
            return {"ok": False, "id": request_id, "error": "未知操作", "kept": True}
        path = message.get("path")
        params = message.get("params") if isinstance(message.get("params"), dict) else None
        if not isinstance(path, str) or not path.startswith("/") or ".." in path:
            return {"ok": False, "id": request_id, "error": "查询路径不合法", "kept": True}
        if params is None:
            return {"ok": False, "id": request_id, "error": "params 必须是对象", "kept": True}
        previous = self.browser.store.load(path, params)
        try:
            result = await self.browser.query(path, params, entry=message.get("entry") or "/")
        except NeedsLogin as exc:
            return {"ok": False, "id": request_id, "error": str(exc), "code": "needs_login", "kept": previous is not None, "previous": previous}
        except ResolveError as exc:
            return {
                "ok": False,
                "id": request_id,
                "error": str(exc),
                "code": exc.code,
                "path": path,
                "kept": previous is not None,
                "previous": previous,
            }
        except Exception as exc:
            return {"ok": False, "id": request_id, "error": str(exc), "code": "call_failed", "kept": previous is not None, "previous": previous}
        return {"ok": True, "id": request_id, **result}


def request_line(socket_path: Path, message: dict, timeout: float = 60) -> dict:
    import socket

    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(timeout)
        client.connect(str(socket_path))
        client.sendall((json.dumps(message, ensure_ascii=False) + "\n").encode("utf-8"))
        chunks = []
        while True:
            piece = client.recv(65536)
            if not piece:
                break
            chunks.append(piece)
            if b"\n" in piece:
                break
    raw = b"".join(chunks).split(b"\n", 1)[0]
    return json.loads(raw.decode("utf-8"))
