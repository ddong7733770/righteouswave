"""
바른결 스마트 런처 (서버 구동 + 브라우저 자동 오픈 + 외부 모바일 터널 연결)
"""

import os
import sys
import time
import urllib.request
import webbrowser
import subprocess
import socket

# 콘솔 UTF-8 설정
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8080


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


def kill_existing_on_port(port):
    """윈도우에서 포트 점유 프로세스 정리"""
    try:
        cmd = f'netstat -ano | findstr :{port}'
        output = subprocess.check_output(cmd, shell=True, text=True, errors="replace")
        for line in output.strip().split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                pid = line.strip().split()[-1]
                if pid and pid != '0':
                    subprocess.call(f'taskkill /F /PID {pid}', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(0.5)
    except Exception:
        pass


def wait_for_server(port, timeout=15):
    url = f"http://127.0.0.1:{port}/api/status"
    start_t = time.time()
    while time.time() - start_t < timeout:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Launcher'})
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def main():
    print("=" * 70)
    print("  [BarunGyeol] Jeong-gak Curation Portal - Launching...")
    print("=" * 70)

    local_url = f"http://localhost:{PORT}"

    # 이미 서버가 돌고 있는지 확인
    if wait_for_server(PORT, timeout=1):
        print("  [OK] Server is already running!")
        print(f"  [PC Browser] Opening URL: {local_url}")
        webbrowser.open(local_url)
        server_proc = None
    else:
        print("  1. Checking port status...")
        if is_port_in_use(PORT):
            print(f"  [*] Cleaning up port {PORT}...")
            kill_existing_on_port(PORT)
            time.sleep(1)

        print("  2. Starting BarunGyeol backend server & curation engine...")
        server_cmd = [sys.executable, "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", str(PORT)]
        server_proc = subprocess.Popen(
            server_cmd,
            cwd=BASE_DIR,
            stdout=sys.stdout,
            stderr=sys.stderr
        )

        print("  3. Waiting for server to be ready...")
        ready = wait_for_server(PORT, timeout=20)

        if ready:
            print("  [OK] Server is ready!")
            print(f"  [PC Browser] Opening URL: {local_url}")
            print("  4. Launching web browser window...")
            webbrowser.open(local_url)
        else:
            print("  [WARN] Server start is taking longer than expected. Please check browser manually.")

    # 외부 인터넷 터널 링크 확인
    print("  5. Connecting mobile (LTE/5G) internet tunnel...")
    tunnel_file = os.path.join(BASE_DIR, "tunnel_url.txt")
    tunnel_url = None

    for _ in range(30):
        if os.path.exists(tunnel_file):
            try:
                with open(tunnel_file, "r", encoding="utf-8") as f:
                    u = f.read().strip()
                    if u.startswith("https://"):
                        tunnel_url = u
                        break
            except Exception:
                pass
        time.sleep(0.5)

    if tunnel_url:
        print("\n" + "#" * 70)
        print("  [MOBILE ACCESS URL - Available worldwide on LTE/5G]")
        print(f"  -> Link: {tunnel_url}")
        print("  - Open this link on your smartphone (Safari, Chrome, Samsung Browser).")
        print("  - Or click [Mobile Connect] button on PC screen to scan QR code!")
        print("#" * 70 + "\n")
    else:
        print("  [INFO] Mobile tunnel is connecting in background. Check [Mobile Connect] on web screen.")

    print("\n  [INFO] To close the application, press Ctrl+C or close this window.\n")

    try:
        if server_proc:
            server_proc.wait()
        else:
            print("\n  [INFO] Press Enter to close this launcher window...")
            input()
    except (KeyboardInterrupt, EOFError):
        if server_proc:
            print("\n  Shutting down server...")
            server_proc.terminate()


if __name__ == "__main__":
    main()
