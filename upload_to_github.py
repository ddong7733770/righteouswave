"""
바른결 (BarunGyeol) GitHub 자동 업로더 및 GitHub Pages 자동 활성화 도구
- Git CLI 설치 여부와 상관없이 Python 표준 라이브러리로 GitHub REST API 직접 통신
- 1. 저장소 생성 -> 2. 파일 일괄 커밋/푸시 -> 3. GitHub Pages 자동 활성화
"""

import os
import sys
import base64
import json
import urllib.request
import urllib.error

# 콘솔 UTF-8 설정
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

IGNORE_PATTERNS = [
    ".git",
    "cloudflared.exe",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "tunnel_url.txt",
    "tunnel.log",
    ".system_generated",
    "upload_to_github.py",
    "upload_to_github.bat"
]


def should_ignore(rel_path: str) -> bool:
    normalized = rel_path.replace("\\", "/")
    parts = normalized.split("/")
    for pat in IGNORE_PATTERNS:
        if pat in parts or normalized.endswith(pat):
            return True
    return False


def make_request(url: str, token: str, method: str = "GET", data: dict = None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "BarunGyeol-Deployer"
    }
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def enable_github_pages(username: str, repo_name: str, token: str):
    """GitHub Pages 활성화 API 호출"""
    url = f"https://api.github.com/repos/{username}/{repo_name}/pages"
    try:
        # Pages 생성 시도
        make_request(url, token, method="POST", data={
            "source": {
                "branch": "main",
                "path": "/"
            }
        })
        print("  [+] GitHub Pages 호스팅 자동 활성화 완료!")
    except urllib.error.HTTPError as e:
        if e.code == 409:
            print("  [+] GitHub Pages가 이미 활성화되어 있습니다.")
        else:
            print(f"  [*] Pages 설정 알림: 저장소 Settings -> Pages 메뉴에서 'Deploy from a branch (main / root)'를 선택하시면 됩니다.")


def upload_repository(token: str, repo_name: str = "bareungyeol", is_private: bool = False):
    print("=" * 70)
    print("  ⚖️ [바른결] GitHub 원클릭 업로드 & GitHub Pages 배포기")
    print("=" * 70)

    print("\n1. GitHub 사용자 계정 인증 중...")
    try:
        user_info = make_request("https://api.github.com/user", token)
        username = user_info["login"]
        print(f"  [+] 로그인 성공: {username} ({user_info.get('name') or username})")
    except Exception as e:
        print(f"  [!] 인증 실패: 토큰이 유효한지 확인하세요. ({e})")
        return

    print(f"\n2. 저장소 '{repo_name}' 생성 또는 확인 중...")
    repo_url = f"https://api.github.com/repos/{username}/{repo_name}"
    repo_exists = False
    try:
        make_request(repo_url, token)
        repo_exists = True
        print(f"  [+] 기존 저장소 발견: https://github.com/{username}/{repo_name}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"  [*] 새 저장소 생성 중: {repo_name} (Public)")
            make_request("https://api.github.com/user/repos", token, method="POST", data={
                "name": repo_name,
                "description": "바른결 - 정각에 만나는 바른 시선 · 모던 정보 큐레이션 포털",
                "private": is_private,
                "auto_init": True
            })
            print(f"  [+] 저장소 생성 완료: https://github.com/{username}/{repo_name}")
        else:
            raise

    base_dir = os.path.dirname(os.path.abspath(__file__))
    files_to_upload = []

    for root, dirs, files in os.walk(base_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, base_dir)
            if not should_ignore(rel_path):
                files_to_upload.append((rel_path, full_path))

    print(f"\n3. 총 {len(files_to_upload)}개 프로젝트 파일 업로드 준비 중...")

    tree_items = []
    for rel_path, full_path in files_to_upload:
        try:
            with open(full_path, "rb") as fp:
                content_bytes = fp.read()
            
            blob_resp = make_request(f"https://api.github.com/repos/{username}/{repo_name}/git/blobs", token, method="POST", data={
                "content": base64.b64encode(content_bytes).decode("ascii"),
                "encoding": "base64"
            })
            tree_items.append({
                "path": rel_path.replace("\\", "/"),
                "mode": "100644",
                "type": "blob",
                "sha": blob_resp["sha"]
            })
            print(f"  -> 업로드: {rel_path}")
        except Exception as err:
            print(f"  [!] 파일 업로드 오류: {rel_path} - {err}")

    print("\n4. 최신 Git 커밋 생성 및 푸시 중...")
    ref_info = make_request(f"https://api.github.com/repos/{username}/{repo_name}/git/refs/heads/main", token)
    latest_commit_sha = ref_info["object"]["sha"]

    tree_resp = make_request(f"https://api.github.com/repos/{username}/{repo_name}/git/trees", token, method="POST", data={
        "base_tree": latest_commit_sha,
        "tree": tree_items
    })

    new_commit = make_request(f"https://api.github.com/repos/{username}/{repo_name}/git/commits", token, method="POST", data={
        "message": "Deploy BarunGyeol - Jeong-gak Curation Web Portal with GitHub Pages support",
        "tree": tree_resp["sha"],
        "parents": [latest_commit_sha]
    })

    make_request(f"https://api.github.com/repos/{username}/{repo_name}/git/refs/heads/main", token, method="PATCH", data={
        "sha": new_commit["sha"]
    })
    print("  [+] GitHub에 모든 소스코드 커밋 & 푸시 완료!")

    # 5. GitHub Pages 활성화
    print("\n5. GitHub Pages 웹 호스팅 설정 중...")
    enable_github_pages(username, repo_name, token)

    web_url = f"https://{username.lower()}.github.io/{repo_name}/"
    print("\n" + "=" * 70)
    print("  🎉 [배포 완료] 바른결 사이트가 GitHub에 성공적으로 배포되었습니다!")
    print("=" * 70)
    print(f"  🌐 내 GitHub 웹사이트 주소: {web_url}")
    print(f"  📂 소스코드 저장소: https://github.com/{username}/{repo_name}")
    print("\n  💡 이제 컴퓨터를 끄셔도, 위 웹사이트 주소로 스마트폰이나 태블릿에서")
    print("     언제 어디서나 바른결 사이트를 바로 이용하실 수 있습니다!")
    print("     (최초 배포 시 GitHub 서버 반영까지 약 1~2분이 소요될 수 있습니다)")
    print("=" * 70 + "\n")


def main():
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        print("GitHub Personal Access Token (토큰)을 입력해 주세요.")
        print("(토큰이 없으시면 https://github.com/settings/tokens 에서 'repo' 권한을 체크하고 생성하세요)")
        token = input("GitHub Token 입력 > ").strip()

    if not token:
        print("[!] 토큰이 입력되지 않아 종료합니다.")
        return

    repo_name = input("저장소 이름 (기본값: bareungyeol) > ").strip()
    if not repo_name:
        repo_name = "bareungyeol"

    upload_repository(token, repo_name)


if __name__ == "__main__":
    main()
