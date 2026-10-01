"""
바른결 (BarunGyeol) FastAPI 웹 서버
- 포트: 8080 (또는 환경변수 PORT)
- 매시 정각 실시간 백그라운드 갱신
- RESTful API 및 현대적 프론트엔드 서빙
"""

import os
import asyncio
import datetime
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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

# 정적 파일 마운트
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class VoteRequest(BaseModel):
    vote: str  # "agree" or "disagree"


@app.get("/")
async def read_index():
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


@app.post("/api/refresh")
async def force_refresh():
    fresh_data = data_service.force_refresh()
    return {
        "status": "success",
        "message": "매시 정각 데이터가 새로 취합 및 업데이트되었습니다.",
        "data": fresh_data
    }


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
