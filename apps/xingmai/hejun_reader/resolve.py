"""Find a BI query function's export alias in the JavaScript loaded by the page."""

from __future__ import annotations

import re
from dataclasses import dataclass


class ResolveError(Exception):
    def __init__(self, code: str, message: str, path: str):
        super().__init__(message)
        self.code = code
        self.path = path


@dataclass(frozen=True)
class ResolvedExport:
    module_url: str
    export_name: str
    local_name: str
    api_path: str


_CALL = re.compile(
    r"(?P<helper>[A-Za-z_$][\w$]*)\(\s*[`\"'](?P<path>/[^`\"']+)[`\"']"
)
_NAMED = re.compile(
    r"(?:(?:async\s+)?function\s+(?P<fname>[A-Za-z_$][\w$]*)\s*\()"
    r"|(?:(?:var|let|const)\s+(?P<vname>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b)"
)
_EXPORT_BLOCK = re.compile(r"export\s*\{([^{}]*)\}")
_EXPORT_PART = re.compile(
    r"^(?P<local>[A-Za-z_$][\w$]*)(?:\s+as\s+(?P<alias>[A-Za-z_$][\w$]*))?$"
)


def export_aliases(source: str) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for block in _EXPORT_BLOCK.findall(source):
        for part in block.split(","):
            piece = part.strip()
            if not piece:
                continue
            match = _EXPORT_PART.match(piece)
            if not match:
                continue
            local = match.group("local")
            alias = match.group("alias") or local
            names = found.setdefault(local, [])
            if alias not in names:
                names.append(alias)
    return found


def _nearest_name(source: str, index: int) -> str:
    chosen = ""
    chosen_at = -1
    for match in _NAMED.finditer(source):
        if match.start() >= index:
            break
        name = match.group("fname") or match.group("vname") or ""
        if name and match.start() >= chosen_at:
            chosen = name
            chosen_at = match.start()
    return chosen


def local_functions(source: str, api_path: str) -> list[str]:
    names: list[str] = []
    for match in _CALL.finditer(source):
        if match.group("path") != api_path:
            continue
        name = _nearest_name(source, match.start())
        if name and name not in names:
            names.append(name)
    return names


def resolve_source(source: str, api_path: str, module_url: str = "") -> ResolvedExport:
    names = local_functions(source, api_path)
    if not names:
        raise ResolveError("not_found", f"当前脚本里没有查询函数：{api_path}", api_path)
    aliases = export_aliases(source)
    exported = [(name, aliases[name][0]) for name in names if aliases.get(name)]
    if len(exported) > 1:
        detail = "、".join(f"{name} as {alias}" for name, alias in exported)
        raise ResolveError("ambiguous", f"这个路径对应多个导出，不能猜：{detail}", api_path)
    if len(exported) == 1:
        local_name, export_name = exported[0]
        return ResolvedExport(module_url, export_name, local_name, api_path)
    if len(names) > 1:
        raise ResolveError("ambiguous", f"这个路径对应多个函数，且没有唯一导出：{'、'.join(names)}", api_path)
    raise ResolveError("not_exported", f"找到函数 {names[0]}，但当前模块没有导出它：{api_path}", api_path)


def resolve_in_modules(modules: list[tuple[str, str]], api_path: str) -> ResolvedExport:
    found: list[ResolvedExport] = []
    errors: list[ResolveError] = []
    for url, source in modules:
        try:
            found.append(resolve_source(source, api_path, url))
        except ResolveError as exc:
            if exc.code != "not_found":
                errors.append(exc)
    if len(found) == 1 and not any(item.code == "ambiguous" for item in errors):
        return found[0]
    if len(found) > 1:
        detail = "、".join(f"{item.module_url}#{item.export_name}" for item in found)
        raise ResolveError("ambiguous", f"多个模块都导出了这个查询：{detail}", api_path)
    if errors:
        raise errors[0]
    raise ResolveError("not_found", f"当前页面加载的脚本里没有查询函数：{api_path}", api_path)
