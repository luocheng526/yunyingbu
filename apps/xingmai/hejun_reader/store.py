"""Last successful query payloads. Failures never replace them."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def snapshot_key(path: str, params: dict) -> str:
    raw = json.dumps({"path": path, "params": params}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


class SnapshotStore:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)

    def file_for(self, path: str, params: dict) -> Path:
        return self.directory / f"{snapshot_key(path, params)}.json"

    def load(self, path: str, params: dict) -> dict | None:
        file = self.file_for(path, params)
        if not file.exists():
            return None
        return json.loads(file.read_text(encoding="utf-8"))

    def save(self, path: str, params: dict, payload, resolved) -> Path:
        file = self.file_for(path, params)
        body = {
            "path": path,
            "params": params,
            "payload": payload,
            "module_url": resolved.module_url,
            "export_name": resolved.export_name,
            "local_name": resolved.local_name,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        temporary = file.with_suffix(".tmp")
        temporary.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(file)
        return file
