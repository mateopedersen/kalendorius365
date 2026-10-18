"""Serve the generated site for browser regressions, with concurrent sockets."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parents[1] / 'public'), **kwargs)

    def log_message(self, *args):
        pass


class Server(ThreadingHTTPServer):
    # Styles, modules, fonts and two simultaneous browsers can exceed the
    # default five pending connections before the first request is accepted.
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    Server(('127.0.0.1', 8790), Handler).serve_forever()
