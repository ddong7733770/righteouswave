"""
바른결 Cloudflare 터널 매니저
- 외부 인터넷(휴대폰 LTE/5G)에서 바로 접속 가능한 HTTPS 주소 자동 생성
"""

import os
import sys
import time
import re
import subprocess
import threading

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)

# cloudflared.exe 검색 (현재 디렉토리 또는 상위 디렉토리)
CLOUDFLARED_CANDIDATES = [
    os.path.join(CURRENT_DIR, "cloudflared.exe"),
    os.path.join(PARENT_DIR, "cloudflared.exe"),
]

CLOUDFLARED_PATH = None
for p in CLOUDFLARED_CANDIDATES:
    if os.path.exists(p):
        CLOUDFLARED_PATH = p
        break

TUNNEL_URL_FILE = os.path.join(CURRENT_DIR, "tunnel_url.txt")
_current_tunnel_url = None
_tunnel_process = None


def get_tunnel_url():
    global _current_tunnel_url
    if _current_tunnel_url:
        return _current_tunnel_url
    if os.path.exists(TUNNEL_URL_FILE):
        try:
            with open(TUNNEL_URL_FILE, "r", encoding="utf-8") as f:
                url = f.read().strip()
                if url.startswith("https://"):
                    _current_tunnel_url = url
                    return url
        except Exception:
            pass
    return None


def start_tunnel_background(port=8080):
    global _current_tunnel_url, _tunnel_process
    if not CLOUDFLARED_PATH:
        print("[Tunnel] cloudflared.exe를 찾을 수 없습니다. (로컬 모드로만 동작)")
        return None

    if os.path.exists(TUNNEL_URL_FILE):
        try:
            os.remove(TUNNEL_URL_FILE)
        except Exception:
            pass

    cmd = [
        CLOUDFLARED_PATH,
        "tunnel",
        "--protocol", "http2",
        "--url", f"http://127.0.0.1:{port}"
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        _tunnel_process = proc

        # 터널 URL 파싱 스레드
        def _read_output():
            global _current_tunnel_url
            for _ in range(60):
                line = proc.stderr.readline()
                if not line:
                    time.sleep(0.2)
                    continue
                if "trycloudflare.com" in line:
                    m = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                    if m:
                        _current_tunnel_url = m.group(0)
                        with open(TUNNEL_URL_FILE, "w", encoding="utf-8") as f:
                            f.write(_current_tunnel_url)
                        print("\n" + "=" * 70)
                        print("  [SUCCESS] Mobile (LTE/5G) Public Internet Tunnel Created!")
                        print(f"  -> Mobile Access URL: {_current_tunnel_url}")
                        print("  (You can open this URL on your phone outside anywhere)")
                        print("=" * 70 + "\n")
                        break

        t = threading.Thread(target=_read_output, daemon=True)
        t.start()
        return proc
    except Exception as e:
        print(f"[Tunnel Error] {e}")
        return None


def stop_tunnel():
    global _tunnel_process
    if _tunnel_process:
        try:
            _tunnel_process.terminate()
        except Exception:
            pass
