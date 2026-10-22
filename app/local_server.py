"""Loopback HTTP server that serves the offline UI and lesson resources.

Why HTTP instead of ``file://``: under ``file://`` Chromium disables ES modules
and ``fetch`` because of CORS, which breaks three.js (ESM-only) and
``fetch(lesson.json)``. Binding to 127.0.0.1 keeps everything offline and avoids
firewall prompts.
"""

from __future__ import annotations

import http.server
import mimetypes
import threading
from pathlib import Path
from urllib.parse import unquote, urlparse

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/wasm", ".wasm")


class _Handler(http.server.BaseHTTPRequestHandler):
    server_version = "OSTrain/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # keep the console quiet
        pass

    def _resolve(self, url_path: str) -> Path | None:
        root: Path = self.server.root  # type: ignore[attr-defined]
        path = unquote(urlparse(url_path).path)
        if path in ("", "/"):
            path = "/ui/index.html"
        target = (root / path.lstrip("/")).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            return None  # directory traversal attempt
        return target

    def _serve(self, head_only: bool) -> None:
        target = self._resolve(self.path)
        if target is None:
            self.send_error(403, "Forbidden")
            return
        if not target.is_file():
            self.send_error(404, "Not Found")
            return
        data = target.read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        self._serve(False)

    def do_HEAD(self) -> None:  # noqa: N802
        self._serve(True)


class LocalServer:
    """Threaded static file server bound to a random loopback port."""

    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self._httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._httpd.root = self.root  # type: ignore[attr-defined]
        self.port = self._httpd.server_address[1]
        self._thread = threading.Thread(
            target=self._httpd.serve_forever, name="ostrain-http", daemon=True
        )

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        try:
            self._httpd.shutdown()
            self._httpd.server_close()
        except Exception:
            pass

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    @property
    def index_url(self) -> str:
        return f"{self.base_url}/ui/index.html"
