"""
바른결 (BarunGyeol) FastAPI 웹 서버
- 포트: 8080 (또는 환경변수 PORT)
- 매시 정각 실시간 백그라운드 갱신
- RESTful API 및 현대적 프론트엔드 서빙
"""

import os
import asyncio
import datetime
import urllib.request
import urllib.parse
import re
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from data_service import data_service
import tunnel_manager

app = FastAPI(title="바른결 - 정각에 만나는 바른 시선", version="1.0.0")

# CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# 정적 파일 마운트 (루트 및 static 호환)
if os.path.exists(os.path.join(BASE_DIR, "css")):
    app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
if os.path.exists(os.path.join(BASE_DIR, "js")):
    app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")
if os.path.exists(os.path.join(BASE_DIR, "data")):
    app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "data")), name="data")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class VoteRequest(BaseModel):
    vote: str  # "agree" or "disagree"


@app.get("/")
async def read_index():
    root_index = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(root_index):
        return FileResponse(root_index)
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)


@app.get("/api/status")
async def get_status():
    return data_service.get_update_status()


@app.get("/api/tunnel-url")
async def get_tunnel_url():
    url = tunnel_manager.get_tunnel_url()
    return {"tunnel_url": url}


@app.get("/api/content")
async def get_content(keyword: str = None):
    data = data_service.get_all_curated_content(filter_keyword=keyword)
    return data


@app.get("/api/search")
async def search_connected_sites(keyword: str):
    """키워드 검색 시 12대 언론사, 유튜브, 커뮤니티 추가 실시간 연결 데이터 반환"""
    extra_data = data_service.search_external_connected_data(keyword)
    return extra_data


@app.post("/api/refresh")
async def force_refresh():
    fresh_data = data_service.force_refresh()
    return {
        "status": "success",
        "message": "매시 정각 데이터가 새로 취합 및 업데이트되었습니다.",
        "data": fresh_data
    }


@app.get("/api/proxy-frame")
async def proxy_frame(url: str):
    """
    언론사 보안 정책(X-Frame-Options, CSP)을 우회하여 인앱 브라우저 iframe에 원문을 안전하게 표시
    """
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return HTMLResponse("<h3>유효하지 않은 링크 주소입니다.</h3>", status_code=400)

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw_bytes = resp.read()

            # 인코딩 자동 판별
            charset = "utf-8"
            if "charset=" in content_type.lower():
                try:
                    charset = content_type.lower().split("charset=")[-1].split(";")[0].strip()
                except Exception:
                    charset = "utf-8"

            try:
                html_text = raw_bytes.decode(charset)
            except Exception:
                try:
                    html_text = raw_bytes.decode("euc-kr")
                except Exception:
                    html_text = raw_bytes.decode("utf-8", errors="replace")

            # 1. 상대 경로 보정을 위해 <base href="..."> 태그 삽입
            base_tag = f'<base href="{url}">'
            if "<head>" in html_text:
                html_text = html_text.replace("<head>", f"<head>\n{base_tag}", 1)
            elif "<HEAD>" in html_text:
                html_text = html_text.replace("<HEAD>", f"<HEAD>\n{base_tag}", 1)
            else:
                html_text = base_tag + html_text

            # 2. 프레임 탈출 방지 스크립트 제거 (top.location 등)
            html_text = re.sub(r'if\s*\(\s*(?:window\.)?top\s*!==\s*(?:window\.)?self\s*\)[^;{]+[;}]', '', html_text, flags=re.IGNORECASE)
            html_text = re.sub(r'(?:window\.)?top\.location\s*=\s*(?:window\.)?self\.location[;]?', '', html_text, flags=re.IGNORECASE)

            # 3. 메타 태그의 CSP 제거
            html_text = re.sub(r'<meta[^>]*http-equiv=[\'"]Content-Security-Policy[\'"][^>]*>', '', html_text, flags=re.IGNORECASE)

            headers = {
                "X-Frame-Options": "ALLOWALL",
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/html; charset=utf-8"
            }
            return HTMLResponse(content=html_text, status_code=200, headers=headers)

    except Exception as e:
        # 가져오기 실패 시 깔끔한 인앱 다이렉트 뷰 제공
        fallback_html = f"""
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>원문 기사 안내</title>
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F8F7FC; color: #1B1823; padding: 20px; box-sizing: border-box; }}
            .box {{ background: #FFFFFF; padding: 36px 28px; border-radius: 16px; box-shadow: 0 8px 24px rgba(54, 23, 206, 0.08); text-align: center; max-width: 480px; width: 100%; border: 1px solid #E8E3F1; }}
            .icon {{ font-size: 2.5rem; margin-bottom: 12px; }}
            h2 {{ font-size: 1.25rem; font-weight: 800; margin: 0 0 10px; color: #1B1823; }}
            p {{ font-size: 0.92rem; color: #5B5568; line-height: 1.5; margin: 0 0 24px; }}
            .btn-go {{ display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 28px; background: linear-gradient(135deg, #7C3AED, #3617CE); color: #FFFFFF; text-decoration: none; border-radius: 9999px; font-weight: 750; font-size: 0.95rem; box-shadow: 0 4px 14px rgba(54, 23, 206, 0.28); }}
            .btn-go:hover {{ transform: translateY(-2px); }}
          </style>
        </head>
        <body>
          <div class="box">
            <div class="icon">📰</div>
            <h2>언론사 원문 페이지 바로보기</h2>
            <p>해당 언론사의 실시간 트래픽 또는 외부 보안 정책으로 인해 브라우저 직접 연결을 권장합니다.</p>
            <a href="{url}" target="_blank" rel="noopener noreferrer" class="btn-go">
              원문 기사 페이지 열기 ↗
            </a>
          </div>
        </body>
        </html>
        """
        return HTMLResponse(content=fallback_html, status_code=200)


@app.get("/api/poll")
async def get_poll():
    return data_service.get_poll_data()


@app.post("/api/poll/vote")
async def vote_poll(request: Request, body: VoteRequest):
    # 클라이언트 IP 식별 (프록시 헤더 고려)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    res = data_service.record_vote(body.vote, client_ip)
    return res


@app.get("/api/weekly-report")
async def get_weekly_report():
    from data_service import WEEKLY_REPORT_DATA
    return WEEKLY_REPORT_DATA


# 백그라운드 매시 정각 자동 갱신 태스크
async def hourly_scheduler():
    while True:
        now = datetime.datetime.now()
        # 다음 정각까지 남은 초 계산
        next_hour = (now.replace(minute=0, second=0, microsecond=0) + datetime.timedelta(hours=1))
        seconds_until_next_hour = (next_hour - now).total_seconds()
        
        # 정각 도달 1초 후 실행되도록 대기
        await asyncio.sleep(max(1, seconds_until_next_hour + 1))
        
        print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [SCHEDULE] Hourly update running...")
        try:
            data_service.force_refresh()
            print("  [OK] Hourly curation updated.")
        except Exception as e:
            print(f"  [ERROR] Hourly update failed: {e}")


@app.on_event("startup")
async def startup_event():
    # 1. 서버 기동 시 초기 데이터 캐시 적재
    print("[STARTUP] BarunGyeol server starting... Loading initial curation data")
    data_service.force_refresh()
    print("[STARTUP] Initial data load complete!")
    
    # 2. 백그라운드 정각 스케줄러 실행
    asyncio.create_task(hourly_scheduler())

    # 3. 외부 인터넷 접속용 Cloudflare 터널 자동 가동 (휴대폰 접속용)
    tunnel_manager.start_tunnel_background(port=8080)


@app.on_event("shutdown")
def shutdown_event():
    tunnel_manager.stop_tunnel()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=False)
