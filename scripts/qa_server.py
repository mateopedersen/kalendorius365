"""Serve the generated site for browser regressions and local preview."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from json import loads
from pathlib import Path
from subprocess import SubprocessError, run
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
SITE_FUNCTIONS = frozenset({'/api/location', '/api/weather', '/api/privacy-region', '/api/oru-prognoze', '/api/keliu-orai'})
RUN_FUNCTION = """
import { readFileSync } from 'node:fs';
const [path, url, directory] = process.argv.slice(1);
const { onRequestGet } = await import('./functions' + path + '.js');
const response = await onRequestGet({
    request: new Request(url),
    env: { ASSETS: { fetch: () => new Response(readFileSync(directory + '/orai/index.html'), {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
    }) }},
    next: () => new Response(null, { status: 404 }),
});
process.stdout.write(JSON.stringify({
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
}));
"""


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, directory=ROOT / 'public', **kwargs):
        super().__init__(*args, directory=str(directory), **kwargs)

    def send_error(self, code, message=None, explain=None):
        # Pages serves the custom document for an unknown URL with HTTP 404.
        error_page = Path(self.directory) / '404.html'
        if code == 404 and error_page.is_file():
            content = error_page.read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(content)
            return
        super().send_error(code, message, explain)

    def log_message(self, *args):
        pass


class PreviewHandler(Handler):
    def do_GET(self):
        if not self.serve_site_function():
            super().do_GET()

    def do_HEAD(self):
        if not self.serve_site_function():
            super().do_HEAD()

    def serve_site_function(self):
        path = urlsplit(self.path).path
        if path.startswith('/orai/') and path != '/orai/':
            path = '/orai/[[route]]'
        if path not in SITE_FUNCTIONS:
            if path != '/orai/[[route]]':
                return False
        try:
            result = run(
                ['node', '--input-type=module', '-e', RUN_FUNCTION,
                 path, f'http://localhost{self.path}', self.directory],
                cwd=ROOT, capture_output=True, check=True, timeout=20,
            )
            response = loads(result.stdout)
        except (OSError, SubprocessError, ValueError):
            self.send_error(503, 'Local site function unavailable')
            return True

        if response['status'] == 404 and path == '/orai/[[route]]':
            self.send_error(404)
            return True
        content = response['body'].encode('utf-8')
        self.send_response(response['status'])
        for name, value in response['headers'].items():
            self.send_header(name, value)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(content)
        return True


class Server(ThreadingHTTPServer):
    # Styles, modules, fonts and two simultaneous browsers can exceed the
    # default five pending connections before the first request is accepted.
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8790)
    parser.add_argument('--site-functions', action='store_true', help='Run the site API locally, including live weather.')
    parser.add_argument('--public-dir', type=Path, default=ROOT / 'public', help='Serve a separate generated site directory.')
    options = parser.parse_args()
    handler = PreviewHandler if options.site_functions else Handler
    Server(('127.0.0.1', options.port), partial(handler, directory=options.public_dir)).serve_forever()
