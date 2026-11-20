"""命令：login、serve、query。"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from hejun_reader.browser import HejunBrowser, NeedsLogin
from hejun_reader.resolve import ResolveError
from hejun_reader.server import ReaderServer, request_line

DEFAULT_ORIGIN = "https://hejun.ecbis.cn"
DEFAULT_PROFILE = Path.home() / ".local" / "share" / "hejun-bi"


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="禾君 BI 只读采集器。用页面自己的查询函数读数。")
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    parser.add_argument("--origin", default=DEFAULT_ORIGIN)
    sub = parser.add_subparsers(dest="command", required=True)

    login = sub.add_parser("login", help="打开持久化浏览器，扫码后回车")
    login.add_argument("--entry", default="/")

    serve = sub.add_parser("serve", help="把已登录的浏览器挂到 Unix Socket")
    serve.add_argument("--socket", type=Path, required=True)
    serve.add_argument("--entry", default="/")

    query = sub.add_parser("query", help="读一条查询。可直连浏览器，或转给已经挂着的 socket")
    query.add_argument("--path", required=True)
    query.add_argument("--params", required=True, help="JSON 对象")
    query.add_argument("--entry", default="/")
    query.add_argument("--socket", type=Path)

    return parser


async def _login(args):
    browser = HejunBrowser(args.profile, args.origin, headless=False)
    await browser.start()
    try:
        await browser.open_app(args.entry)
        print("请在打开的浏览器里完成禾君 BI 登录。登录状态会留在这个 profile。完成后回车。", flush=True)
        await asyncio.to_thread(sys.stdin.readline)
        print("已登录" if await browser.logged_in() else "看起来还没有登录", flush=True)
    finally:
        await browser.stop()


async def _serve(args):
    browser = HejunBrowser(args.profile, args.origin, headless=True)
    await browser.start()
    await browser.open_app(args.entry)
    server = ReaderServer(browser, args.socket)
    await server.start()
    print(f"listening {args.socket}", flush=True)
    try:
        await server.serve_forever()
    finally:
        await server.stop()
        await browser.stop()


async def _query(args):
    params = json.loads(args.params)
    if not isinstance(params, dict):
        raise SystemExit("params 必须是 JSON 对象")
    if args.socket:
        print(json.dumps(request_line(args.socket, {"op": "query", "path": args.path, "params": params, "entry": args.entry}), ensure_ascii=False))
        return
    browser = HejunBrowser(args.profile, args.origin, headless=True)
    await browser.start()
    try:
        try:
            result = await browser.query(args.path, params, entry=args.entry)
        except NeedsLogin as exc:
            print(json.dumps({"ok": False, "error": str(exc), "code": "needs_login", "kept": True}, ensure_ascii=False))
            return
        except ResolveError as exc:
            previous = browser.store.load(args.path, params)
            print(json.dumps({"ok": False, "error": str(exc), "code": exc.code, "kept": previous is not None, "previous": previous}, ensure_ascii=False))
            return
        print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    finally:
        await browser.stop()


def main():
    args = _parser().parse_args()
    if args.command == "login":
        asyncio.run(_login(args))
    elif args.command == "serve":
        asyncio.run(_serve(args))
    elif args.command == "query":
        asyncio.run(_query(args))
    else:
        raise SystemExit(f"未知命令 {args.command}")


if __name__ == "__main__":
    main()
