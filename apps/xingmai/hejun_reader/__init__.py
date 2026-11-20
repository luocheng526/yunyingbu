"""Read-only Hejun BI collector.

The collector keeps a Chromium profile, finds the query function the current
page actually exports, and calls that function with import(). It does not
guess request bodies.
"""

from hejun_reader.resolve import ResolveError, ResolvedExport, resolve_in_modules

__all__ = ["ResolveError", "ResolvedExport", "resolve_in_modules"]
