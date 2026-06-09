import os
import json
import sys
import subprocess
import threading
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer
import requests
import re

# Load environment variables manually from .env if present
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, val = line.split("=", 1)
                        val = val.strip().strip("'").strip('"')
                        os.environ[key.strip()] = val

load_env()

PORT = 8000

class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress normal request logs to keep terminal clean
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-Requested-With, Range')
        self.end_headers()

    def do_GET(self):
        # ----------------------------------------------------------------
        # /api/transcode-video/<id>
        # Downloads from Pixeldrain, transcodes HEVC→H.264 via ffmpeg,
        # streams the result directly to the browser as video/mp4.
        # This fixes H.265/HEVC videos that Chrome cannot render natively.
        # ----------------------------------------------------------------
        match = re.match(r'^/api/transcode-video/([a-zA-Z0-9_-]+)$', self.path)
        if match:
            file_id = match.group(1)
            self._transcode_and_stream(file_id)
            return

        # ----------------------------------------------------------------
        # /api/stream-video/<id>  (raw proxy – used as fallback)
        # ----------------------------------------------------------------
        match = re.match(r'^/api/stream-video/([a-zA-Z0-9_-]+)$', self.path)
        if match:
            file_id = match.group(1)
            self._raw_proxy(file_id)
            return

        # Default: serve static files
        super().do_GET()

    # ------------------------------------------------------------------
    # Transcode: pipe Pixeldrain → ffmpeg (H.264) → browser
    # ------------------------------------------------------------------
    def _transcode_and_stream(self, file_id):
        api_key = os.environ.get('PIXELDRAIN_API_KEY')
        pd_url = f'https://pixeldrain.net/api/file/{file_id}'
        auth_str = f':{api_key}' if api_key else ':'
        import base64
        auth_header = 'Basic ' + base64.b64encode(auth_str.encode()).decode()

        print(f"Transcode: Starting for file_id={file_id}")

        try:
            # ffmpeg command:
            #  -i pipe:0          → read input from stdin (piped from requests)
            #  -vcodec libx264    → re-encode video to H.264
            #  -acodec aac        → re-encode audio to AAC
            #  -preset ultrafast  → fastest encoding (low CPU for preview)
            #  -crf 28            → quality (lower = better, 28 = good preview quality)
            #  -movflags frag_keyframe+empty_moov+faststart
            #                     → fragmented MP4 so browser can start playing immediately
            #  -f mp4             → output format
            #  pipe:1             → write output to stdout
            ffmpeg_cmd = [
                'ffmpeg',
                '-loglevel', 'error',
                '-i', 'pipe:0',
                '-vcodec', 'libx264',
                '-acodec', 'aac',
                '-preset', 'ultrafast',
                '-crf', '28',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  # ensure even dimensions
                '-movflags', 'frag_keyframe+empty_moov+faststart',
                '-f', 'mp4',
                'pipe:1'
            ]

            # Start ffmpeg process
            ffmpeg_proc = subprocess.Popen(
                ffmpeg_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            # Stream Pixeldrain download into ffmpeg stdin in a background thread
            def feed_ffmpeg():
                try:
                    req_headers = {
                        'User-Agent': 'Mozilla/5.0',
                        'Authorization': auth_header
                    }
                    pd_resp = requests.get(pd_url, headers=req_headers, stream=True, timeout=120)
                    for chunk in pd_resp.iter_content(chunk_size=256 * 1024):
                        if chunk:
                            try:
                                ffmpeg_proc.stdin.write(chunk)
                            except BrokenPipeError:
                                break
                except Exception as ex:
                    print(f"Transcode feed error: {ex}")
                finally:
                    try:
                        ffmpeg_proc.stdin.close()
                    except Exception:
                        pass

            feeder = threading.Thread(target=feed_ffmpeg, daemon=True)
            feeder.start()

            # Send HTTP response headers
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()

            # Stream ffmpeg stdout directly to browser
            while True:
                chunk = ffmpeg_proc.stdout.read(64 * 1024)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    print("Transcode: Client disconnected.")
                    break

            ffmpeg_proc.wait()
            print(f"Transcode: Done for file_id={file_id} (return code {ffmpeg_proc.returncode})")

        except Exception as e:
            print(f"Transcode error: {e}")
            try:
                self.send_error_response(500, str(e))
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Raw proxy (fallback, no transcoding)
    # ------------------------------------------------------------------
    def _raw_proxy(self, file_id):
        try:
            api_key = os.environ.get('PIXELDRAIN_API_KEY')
            pd_url = f'https://pixeldrain.net/api/file/{file_id}'
            auth = ('', api_key) if api_key else None

            range_header = self.headers.get('Range')
            req_headers = {'User-Agent': 'Mozilla/5.0'}
            if range_header:
                req_headers['Range'] = range_header

            pd_resp = requests.get(pd_url, auth=auth, headers=req_headers, stream=True, timeout=30)

            self.send_response(pd_resp.status_code)
            self.send_header('Content-Type', pd_resp.headers.get('Content-Type', 'video/mp4'))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Accept-Ranges', 'bytes')
            if 'Content-Length' in pd_resp.headers:
                self.send_header('Content-Length', pd_resp.headers['Content-Length'])
            if 'Content-Range' in pd_resp.headers:
                self.send_header('Content-Range', pd_resp.headers['Content-Range'])
            self.end_headers()

            for chunk in pd_resp.iter_content(chunk_size=64 * 1024):
                if chunk:
                    self.wfile.write(chunk)
        except Exception as e:
            print(f'Stream proxy error: {e}')
            self.send_error_response(500, str(e))

    def do_POST(self):
        if self.path == '/api/upload-video':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                file_name = urllib.parse.unquote(self.headers.get('X-File-Name', 'campaign_video.mp4'))

                print(f"Proxy: Receiving upload '{file_name}' ({content_length / (1024*1024):.1f} MB)...")

                temp_dir = "temp_uploads"
                os.makedirs(temp_dir, exist_ok=True)
                temp_path = os.path.join(temp_dir, file_name)

                remaining = content_length
                chunk_size = 8 * 1024 * 1024
                with open(temp_path, 'wb') as f:
                    while remaining > 0:
                        to_read = min(chunk_size, remaining)
                        chunk = self.rfile.read(to_read)
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)

                api_key = os.environ.get("PIXELDRAIN_API_KEY")
                print(f"Proxy: Upload complete locally. Uploading to Pixeldrain (auth: {bool(api_key)})...")

                url = "https://pixeldrain.net/api/file"
                auth = ('', api_key) if api_key else None

                with open(temp_path, 'rb') as f:
                    files = {'file': (file_name, f)}
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                    response = requests.post(url, files=files, headers=headers, auth=auth)

                if os.path.exists(temp_path):
                    os.remove(temp_path)

                print(f"Proxy: Pixeldrain response code: {response.status_code}")
                try:
                    pd_data = response.json()
                    file_id = pd_data.get('id', '')
                    result = json.dumps({"success": True, "id": file_id}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(result)
                    print(f"Proxy: Uploaded to Pixeldrain, id={file_id}")
                except Exception as parse_err:
                    print(f"Proxy: Failed to parse Pixeldrain JSON: {parse_err}")
                    self.send_response(response.status_code)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response.content)

            except Exception as e:
                print(f"Upload error: {e}")
                self.send_error_response(500, str(e))
            return

        super().do_POST()

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "message": message}).encode('utf-8'))


def run():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)

    server_address = ('', PORT)
    httpd = HTTPServer(server_address, CustomHTTPRequestHandler)
    print(f"WeCareBidar Local Server running at http://localhost:{PORT}/")
    print("ffmpeg transcoding endpoint: /api/transcode-video/<id>")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)

if __name__ == '__main__':
    run()
