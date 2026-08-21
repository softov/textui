#!/usr/bin/env python3
"""Serve the built docs site, honouring `baseurl`.

The site is built with `baseurl: /textui`, so every link and stylesheet in it is
absolute at `/textui/...`. Pointing `python -m http.server` at `docs/_site`
therefore 404s on everything: the page asks for `/textui/assets/style.css` and
the server looks for `_site/textui/assets/style.css`, which does not exist.

This serves `_site` *mounted under* that prefix instead, so the built site is
byte-for-byte what GitHub Pages will serve. No rebuild, no Ruby, no container.

    scripts/docs-preview.py                    http://localhost:8000/textui/
    scripts/docs-preview.py 9000               another port
    scripts/docs-preview.py --host 0.0.0.0     reachable from the network
    scripts/docs-preview.py 0.0.0.0:9000       both, in one argument

The default binds loopback only. `--host 0.0.0.0` is what you want to read the
docs from a phone, another box, or the host of a VM this runs in.
"""
import argparse
import http.server
import os
import re
import socket
import socketserver
import sys
from functools import partial

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
SITE = os.path.normpath(os.path.join(ROOT, "_site"))


def read_baseurl() -> str:
    """Whatever _config.yml says, normalised to '' or '/prefix'."""
    try:
        with open(os.path.join(ROOT, "_config.yml"), encoding="utf-8") as fh:
            m = re.search(r"^baseurl:\s*(.*)$", fh.read(), re.M)
    except OSError:
        return ""
    if not m:
        return ""
    value = m.group(1).strip().strip("\"'").strip("/")
    return "/" + value if value else ""


def split_bind(text, host, port):
    """`8000`, `0.0.0.0`, `0.0.0.0:8000` or `[::1]:8000` -> (host, port)."""
    if text is None:
        return host, port
    if text.isdigit():
        return host, int(text)
    if text.startswith("["):                      # bracketed IPv6, maybe :port
        addr, _, rest = text[1:].partition("]")
        return addr, int(rest[1:]) if rest.startswith(":") else port
    left, sep, right = text.rpartition(":")
    if sep and right.isdigit() and ":" not in left:
        return (left or host), int(right)
    return text, port                             # a bare host, or bare IPv6


def lan_address():
    """This machine's address on the network, without sending anything."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))       # TEST-NET-1: routed, never answers
            return probe.getsockname()[0]
    except OSError:
        return None


parser = argparse.ArgumentParser(
    description="Serve docs/_site under the baseurl the pages ask for.",
    formatter_class=argparse.RawDescriptionHelpFormatter,
)
parser.add_argument("bind", nargs="?", help="PORT, HOST, or HOST:PORT")
parser.add_argument("--host", "-H", default="127.0.0.1",
                    help="address to bind (default: 127.0.0.1; use 0.0.0.0 for the network)")
parser.add_argument("--port", "-p", type=int, default=8000, help="port (default: 8000)")
args = parser.parse_args()

# The positional wins where it says something: `0.0.0.0:9000 --port 8000` is a
# contradiction, and the one written last on the address is the one meant.
HOST, PORT = split_bind(args.bind, args.host, args.port)
BASE = read_baseurl().rstrip("/")


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip the baseurl prefix, then resolve inside _site as usual.
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if BASE and (clean == BASE or clean.startswith(BASE + "/")):
            path = clean[len(BASE):] or "/"
        return super().translate_path(path)

    def do_GET(self):
        # Bare / is not part of the site; send the reader where the site starts.
        if BASE and self.path.split("?", 1)[0].rstrip("/") == "":
            self.send_response(302)
            self.send_header("Location", BASE + "/")
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        status = str(args[1]) if len(args) > 1 else ""
        if not status.startswith("2") and not status.startswith("3"):
            super().log_message(fmt, *args)


class Server(socketserver.TCPServer):
    allow_reuse_address = True
    # A ':' in the host means IPv6, and the default AF_INET would refuse it.
    address_family = socket.AF_INET6 if ":" in HOST else socket.AF_INET


if not os.path.isdir(SITE):
    sys.exit("docs/_site does not exist - build it first: scripts/docs-serve.sh --build")

try:
    httpd = Server((HOST, PORT), partial(Handler, directory=SITE))
except OSError as err:
    sys.exit(f"cannot bind {HOST}:{PORT} - {err}")

shown = "localhost" if HOST in ("127.0.0.1", "::1", "") else HOST
if HOST in ("0.0.0.0", "::"):
    lan = lan_address()
    print(f"serving docs/_site at http://localhost:{PORT}{BASE}/")
    if lan:
        print(f"                 and http://{lan}:{PORT}{BASE}/  (this machine on the network)")
else:
    print(f"serving docs/_site at http://{shown}:{PORT}{BASE}/")
print("only failures are logged - ctrl-c to stop")

with httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print()
