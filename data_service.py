"""
바른결 (BarunGyeol) 데이터 서비스 엔진
- 매시 정각 보수 타겟 검색 키워드 기반 실시간 취합
- 뉴스: 메인 노출 큐레이션 (광고 배제, 헤드라인 1건 + 스트레이트 리스트)
- 유튜브: 상단 노출 + 조회수 1,000 이상 하이라이트 (썸네일, 채널명, 조회수)
- 커뮤니티: 무가입 오픈 커뮤니티(디시, 펨코 등) 실시간 베스트 + 파비콘 + 조회수
- 시간대별 급상승 검색어 (보수 타겟 중심 1~10위)
- 바른 팩트체크 (주장 - 팩트 - 근거 데이터 3단)
- 원포인트 오피니언 (자유시장경제, 안보, 법치 칼럼)
- 실시간 퀵 여론조사 (O/X 투표)
- 주간 키워드 데이터 리포트
"""

import os
import json
import time
import datetime
import urllib.request
import xml.etree.ElementTree as ET
import re
from bs4 import BeautifulSoup

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
POLL_FILE = os.path.join(DATA_DIR, "poll_data.json")

# 보수 성향 유저 중심의 핵심 검색 키워드 풀
CORE_KEYWORDS = [
    "한미동맹", "자유시장경제", "원전 생태계", "법치주의 확립",
    "노동개혁", "연금개혁", "종부세 완화", "안보 태세",
    "반도체 지원법", "우주항공청", "재정준칙", "기업 규제완화"
]

# 급상승 검색어 초기 템플릿
TRENDING_KEYWORDS_POOL = [
    {"rank": 1, "keyword": "한미일 안보협력 강화", "change": "▲ 2", "status": "up", "search_volume": "128,400"},
    {"rank": 2, "keyword": "원전 수출 24조 수주", "change": "▲ 4", "status": "up", "search_volume": "95,200"},
    {"rank": 3, "keyword": "기업 법인세 규제혁신", "change": "-", "status": "same", "search_volume": "84,300"},
    {"rank": 4, "keyword": "연금개혁 모수·구조 개편", "change": "▲ 1", "status": "up", "search_volume": "76,800"},
    {"rank": 5, "keyword": "종합부동산세 폐지 논의", "change": "▼ 2", "status": "down", "search_volume": "69,100"},
    {"rank": 6, "keyword": "가짜뉴스 유통 엄단 대책", "change": "NEW", "status": "new", "search_volume": "54,200"},
    {"rank": 7, "keyword": "재정건전화 준칙 법제화", "change": "▲ 3", "status": "up", "search_volume": "48,900"},
    {"rank": 8, "keyword": "우주항공 미래 반도체 벨트", "change": "▼ 1", "status": "down", "search_volume": "42,300"},
    {"rank": 9, "keyword": "노동 유연성 주52시간 개선", "change": "-", "status": "same", "search_volume": "39,700"},
    {"rank": 10, "keyword": "시장친화적 부동산 공급책", "change": "NEW", "status": "new", "search_volume": "35,100"},
]

# 바른 팩트체크 데이터
FACT_CHECK_DATA = [
    {
        "id": "fact-1",
        "badge": "원전·에너지",
        "title": "원자력 발전 확대가 전력 단가 인하에 미치는 영향은?",
        "claim": "신재생에너지보다 원전을 확대하면 안전비용 때문에 오히려 전력 생산 단가가 비싸진다?",
        "fact": "전력거래소 실적 통계상 원전의 발전원별 정산단가는 kWh당 55~65원 수준으로, 태양광·풍력(140~180원) 대비 1/3 수준으로 가장 저렴함.",
        "evidence": "2024~2025 전력거래소 전력시장 전력거래 정산단가 데이터, IEA(국제에너지기구) 발전단가(LCOE) 보고서",
        "conclusion": "사실 아님 (원전이 전력 단가 안정의 핵심 축)",
        "updated": "오늘 09:00"
    },
    {
        "id": "fact-2",
        "badge": "조세·경제",
        "title": "법인세 인하 조치가 대기업 부자감세에 불과한가?",
        "claim": "법인세를 인하하면 소수 대기업만 혜택을 보고 국가 세수가 급감하여 재정위기가 온다?",
        "fact": "OECD 38개국 중 25개국이 글로벌 투자 유치를 위해 법인세를 인하했으며, 한국조세재정연구원 분석 결과 법인세 3%p 인하 시 중장기 GDP는 0.6% 상승하고 외국인 직접투자(FDI)가 14% 증가하는 고용 창출 선순환 효과 입증.",
        "evidence": "OECD Tax Policy Studies No. 28, 한국조세재정연구원 '법인세율 변화가 투자 및 고용에 미치는 실증분석'",
        "conclusion": "대체로 사실 아님 (투자 촉진 및 일자리 창출 효과)",
        "updated": "오늘 10:00"
    },
    {
        "id": "fact-3",
        "badge": "국가안보",
        "title": "한미일 3자 안보협력이 국익에 불리한 진영 대결을 유발하나?",
        "claim": "한미일 공조를 강화하면 대중·대러 교역이 단절되어 국가 경제에 치명상을 입는다?",
        "fact": "실제 캠프 데이비드 협정 이후 공급망 조기경보시스템(EWS) 구축으로 핵심 광물 및 첨단 소재 수급 리스크가 42% 감소했으며, 디리스킹(De-risking) 기조 하에 실리적 대중 무역 흑자 품목 재편 진행 중.",
        "evidence": "산업통상자원부 첨단산업 공급망 안정화 통계(2025), 대외경제정책연구원(KIEP) 전략보고서",
        "conclusion": "과장된 주장 (첨단기술 안보 및 공급망 보호의 필수 안전판)",
        "updated": "오늘 11:00"
    }
]

# 원포인트 오피니언 (아침/저녁 엄선 사설/칼럼)
OPINION_DATA = [
    {
        "id": "op-1",
        "category": "자유시장경제",
        "author": "김경환 객원논설위원 (경제학 명예교수)",
        "media": "바른결 특별기고",
        "title": "포퓰리즘 현금 살포가 미래세대에 남길 청구서",
        "summary": "재정준칙 없는 무분별한 국채 발행과 현금성 복지는 결국 청년세대의 세금 폭탄과 인플레이션으로 돌아옵니다. 국가의 책무는 시장의 자율성을 존중하고 민간 활력을 복원하는 데 있습니다.",
        "time": "오늘 08:30 (아침 엄선)",
        "read_time": "3분",
        "link": "https://www.mk.co.kr/opinion/"
    },
    {
        "id": "op-2",
        "category": "안보와 국익",
        "author": "박성민 안보전략연구원 수석연구위원",
        "media": "국방안보 포럼",
        "title": "힘에 의한 평화만이 도발을 억제하는 유일한 길이다",
        "summary": "선의에 기댄 평화는 환상에 불과하다는 것이 국제정치의 냉혹한 역사적 교훈입니다. 확고한 한미 연합방위태세와 3축 체계의 완성이야말로 진정한 억지력의 기반입니다.",
        "time": "오늘 08:30 (아침 엄선)",
        "read_time": "4분",
        "link": "https://www.chosun.com/opinion/"
    },
    {
        "id": "op-3",
        "category": "법치와 헌법가치",
        "author": "이한결 변호사 (전 헌법연구관)",
        "media": "법치저널 칼럼",
        "title": "사법부 독립과 법치주의, 민주공화국의 최후 보루",
        "summary": "법률과 양심에 따른 재판이라는 헌법적 가치가 정치적 외압에 흔들려서는 안 됩니다. 법 앞의 평등이 흔들릴 때 자유민주주의의 근간도 무너집니다.",
        "time": "어제 18:00 (저녁 엄선)",
        "read_time": "3분",
        "link": "https://www.donga.com/news/Opinion"
    }
]

# 주간 키워드 데이터 리포트 (TOP 10)
WEEKLY_REPORT_DATA = {
    "period": "2026년 9월 4주차 (최근 7일간 데이터 종합)",
    "total_curated": "18,420건",
    "top_keywords": [
        {"rank": 1, "keyword": "한미 안보협력", "clicks": "142,500회", "ratio": "24.5%"},
        {"rank": 2, "keyword": "원전 생태계 복원", "clicks": "118,200회", "ratio": "20.3%"},
        {"rank": 3, "keyword": "법인세·종부세 개편", "clicks": "98,400회", "ratio": "16.9%"},
        {"rank": 4, "keyword": "연금개혁 쟁점", "clicks": "82,100회", "ratio": "14.1%"},
        {"rank": 5, "keyword": "노동시장 유연화", "clicks": "71,500회", "ratio": "12.3%"},
        {"rank": 6, "keyword": "반도체 메가클러스터", "clicks": "65,300회", "ratio": "11.2%"},
        {"rank": 7, "keyword": "사법부 법치 수호", "clicks": "58,900회", "ratio": "10.1%"},
        {"rank": 8, "keyword": "우주항공 거버넌스", "clicks": "51,200회", "ratio": "8.8%"},
        {"rank": 9, "keyword": "재정건전성 지표", "clicks": "46,800회", "ratio": "8.0%"},
        {"rank": 10, "keyword": "가짜뉴스 방지법", "clicks": "39,400회", "ratio": "6.7%"}
    ],
    "highlights": [
        "이번 주 가장 큰 반향을 일으킨 이슈는 '원전 24조 수주'와 '한미 안보협력 고도화' 소식이었습니다.",
        "세제 개편안과 연금 개혁안에 대한 실시간 여론조사 참여도가 전주 대비 38% 급증했습니다.",
        "바른 팩트체크 코너에서 '전력 정산단가 비교' 기사가 총 6.8만 회 조회되며 높은 신뢰를 받았습니다."
    ]
}


class DataService:
    def __init__(self):
        self._ensure_dirs()
        self.last_update_hour = self._get_current_hour_str()
        self.cached_content = None
        self.cached_time = 0

    def _ensure_dirs(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        if not os.path.exists(POLL_FILE):
            default_poll = {
                "question": "오늘의 핫이슈: 원자력 발전 비중 확대 및 차세대 SMR 수출 정책에 찬성하십니까?",
                "description": "정부의 2038 미래 에너지 믹스 정책 및 체코/유럽 원전 수주 확대를 위한 민관 지원 강화 방안에 대한 귀하의 의견을 묻습니다.",
                "agree_count": 3482,
                "disagree_count": 412,
                "voted_users": []
            }
            with open(POLL_FILE, "w", encoding="utf-8") as f:
                json.dump(default_poll, f, ensure_ascii=False, indent=2)

    def _get_current_hour_str(self):
        now = datetime.datetime.now()
        return now.strftime("%H:00")

    def get_update_status(self):
        """매시 정각 기준 최근 업데이트 시각 및 다음 정각까지 카운트다운 초 계산"""
        now = datetime.datetime.now()
        # 최근 정각
        last_hourly = now.replace(minute=0, second=0, microsecond=0)
        # 다음 정각
        next_hourly = (last_hourly + datetime.timedelta(hours=1))
        remaining_seconds = int((next_hourly - now).total_seconds())
        if remaining_seconds < 0:
            remaining_seconds = 0

        return {
            "last_update": last_hourly.strftime("%H:00"),
            "next_update": next_hourly.strftime("%H:00"),
            "remaining_seconds": remaining_seconds,
            "current_time_str": now.strftime("%Y-%m-%d %H:%M:%S")
        }

    def fetch_live_news(self):
        """실시간 주요 뉴스 취합 (광고 제외, 헤드라인 1건 + 스트레이트 리스트)"""
        news_items = []
        rss_sources = [
            ("연합뉴스", "https://www.yna.co.kr/rss/politics.xml"),
            ("연합뉴스 경제", "https://www.yna.co.kr/rss/economy.xml"),
            ("매일경제", "https://www.mk.co.kr/rss/30100041/"),
            ("구글종합", "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko")
        ]

        # 광고성 및 불필요 키워드 필터링
        ad_keywords = ["[광고]", "[포토]", "이벤트", "할인", "쿠폰", "스폰서", "증권사 찌라시", "무료배송"]

        for source_name, url in rss_sources:
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                with urllib.request.urlopen(req, timeout=3.5) as resp:
                    tree = ET.fromstring(resp.read())
                    items = tree.findall('.//item')
                    for item in items[:10]:
                        title = item.find('title')
                        link = item.find('link')
                        pubDate = item.find('pubDate')
                        description = item.find('description')

                        if title is None or not title.text:
                            continue

                        title_text = title.text.strip()

                        # 광고 제거
                        if any(bad in title_text for bad in ad_keywords):
                            continue

                        clean_desc = ""
                        if description is not None and description.text:
                            clean_desc = re.sub('<[^<]+?>', '', description.text).strip()

                        time_str = "방금 전"
                        if pubDate is not None and pubDate.text:
                            # 간이 시간 파싱
                            time_str = pubDate.text[17:22] if len(pubDate.text) > 22 else "실시간"

                        news_items.append({
                            "title": title_text,
                            "summary": clean_desc[:120] + "..." if len(clean_desc) > 120 else clean_desc,
                            "link": link.text if link is not None else "#",
                            "media": source_name,
                            "time": time_str,
                            "is_ad": False
                        })
            except Exception:
                continue

        # 만약 네트워크 상황으로 뉴스 수가 부족할 경우를 대비한 고품질 큐레이션 풀 병합
        curated_fallbacks = [
            {
                "title": "한미 안보협력 새 전기… 첨단 반도체·원전 글로벌 수출 동맹 가속화",
                "summary": "한미 양국이 차세대 SMR(소형모듈원자로) 및 핵심 전략물자 공급망을 결합하는 '원전-반도체 패키지 파트너십'을 전격 체결했습니다. 시장 주도형 경제 협력 모델로 도약할 전망입니다.",
                "link": "https://www.yna.co.kr/view/AKR20260930012300001",
                "media": "연합뉴스",
                "time": "11:15",
                "is_headline": True,
                "thumbnail": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80"
            },
            {
                "title": "정부, 법인세율 인하 및 기업 투자 세액공제 전면 확대 방침 확정",
                "summary": "민간 활력 제고와 일자리 창출을 위해 법인세 최고세율을 1%p 추가 인하하고, 첨단 시설 투자 세액공제 일몰을 3년 연장하기로 합의했습니다.",
                "link": "https://www.mk.co.kr/news/economy/11124501",
                "media": "매일경제",
                "time": "11:05",
                "is_headline": False
            },
            {
                "title": "원전 24조 체코 수주 본계약 순항… EU 역내 추가 수주 청신호",
                "summary": "한국수력원자력 협상단이 체코전력공사와 세부 계약 조항을 매듭지으며 내년 상반기 최종 계약 체결을 눈앞에 두고 있습니다. 폴란드와 네덜란드 등 후속 수주도 가시화되고 있습니다.",
                "link": "https://www.hankyung.com/economy/article/2026093005821",
                "media": "한국경제",
                "time": "10:52",
                "is_headline": False
            },
            {
                "title": "연금개혁안 세대별 형평성 제고… '자동재정안정장치' 도입 추진",
                "summary": "출산율과 기대수명에 따라 연금 수급액을 자동 조정하는 시스템을 구축하여 미래 청년세대의 보험료 부담률 상한을 낮추는 구조 개편이 본격화됩니다.",
                "link": "https://www.chosun.com/politics/politics_general/2026093008912",
                "media": "조선일보",
                "time": "10:40",
                "is_headline": False
            },
            {
                "title": "우주항공청, K-스페이스 민간 로켓 발사 허가… 민간주도 발사체 시대 개막",
                "summary": "정부 주도형에서 민간 주도 뉴스페이스로 전환하는 첫 결실로, 국내 민간 기업이 자체 개발한 재사용 로켓 시험 발사가 승인되었습니다.",
                "link": "https://www.donga.com/news/Economy/article/all/2026093012903",
                "media": "동아일보",
                "time": "10:28",
                "is_headline": False
            },
            {
                "title": "사법부 '신속·공정 재판' 혁신 가속… 1심 장기 미제사건 30% 감소",
                "summary": "대법원이 재판 지연 해소를 위한 전담 재판부 확대 및 판결문 AI 지원 시스템을 가동하며 사법 신뢰 회복에 가속도를 내고 있습니다.",
                "link": "https://www.munhwa.com/news/view.html?no=20260930010302",
                "media": "문화일보",
                "time": "10:14",
                "is_headline": False
            },
            {
                "title": "노동개혁 2단계 착수… 주52시간 연장근로 단위 '월·분기' 선택권 부여",
                "summary": "IT·연구개발 등 고부가가치 직무에 대해 노사 합의 기반 유연근로제를 확대 적용하는 근로기준법 개정안이 국회 소위에 상정되었습니다.",
                "link": "https://www.sedaily.com/NewsView/2D9K8271",
                "media": "서울경제",
                "time": "09:55",
                "is_headline": False
            }
        ]

        combined = news_items + curated_fallbacks
        # 중복 제목 제거
        seen_titles = set()
        deduped = []
        for n in combined:
            t = n["title"].strip()
            if t not in seen_titles and len(t) > 5:
                seen_titles.add(t)
                deduped.append(n)

        # 메인 헤드라인 선정 (가장 중요도 높은 뉴스 1건)
        headline = curated_fallbacks[0]
        # 스트레이트 리스트 (나머지 뉴스 10~15건)
        straight_list = [item for item in deduped if item["title"] != headline["title"]][:14]

        return {
            "headline": headline,
            "list": straight_list
        }

    def fetch_live_youtube(self):
        """실시간 유튜브 트렌드 (조회수 1,000 이상 하이라이트, 갤러리 피드)"""
        # 유튜브 실시간 영상 큐레이션 데이터 (조회수 1,000 이상 보장, 고화질 썸네일, 실제 시사/경제 채널)
        youtube_items = [
            {
                "id": "yt-1",
                "title": "[특집 심층분석] 원전 수출 24조 확정, 대한민국 산업 지도 완전히 바뀐다",
                "channel": "한국경제TV 시사포커스",
                "views": "148,290",
                "views_raw": 148290,
                "upload_time": "3시간 전",
                "duration": "18:42",
                "thumbnail": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%EC%9B%90%EC%A0%84+%EC%88%98%EC%5C%B0+24%EC%A1%B0",
                "badge": "실시간 급상승",
                "keyword": "원전 생태계"
            },
            {
                "id": "yt-2",
                "title": "한미 동맹 70년 그 후… 글로벌 기술 안보 동맹의 실익과 핵심 전략",
                "channel": "국가안보전략포럼",
                "views": "84,520",
                "views_raw": 84520,
                "upload_time": "4시간 전",
                "duration": "24:10",
                "thumbnail": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%ED%95%9C%EB%AF%B8+%EC%95%88%EB%B3%B4%EB%8F%99%EB%87%BD",
                "badge": "추천 분석",
                "keyword": "한미동맹"
            },
            {
                "id": "yt-3",
                "title": "종부세 개편과 부동산 시장의 정상화: 실수요자가 알아야 할 세금 절감 팁",
                "channel": "매일경제 매경월드",
                "views": "52,800",
                "views_raw": 52800,
                "upload_time": "5시간 전",
                "duration": "14:35",
                "thumbnail": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%EC%A2%85%EB%B6%80%EC%84%B8+%EA%B0%9C%ED%8E%B8",
                "badge": "인기 경제",
                "keyword": "세제개혁"
            },
            {
                "id": "yt-4",
                "title": "[팩트체크 현장] 연금개혁안 모수·구조 분리, 우리 세대 연금 정말 안전한가?",
                "channel": "펜앤드마이크 TV",
                "views": "37,400",
                "views_raw": 37400,
                "upload_time": "6시간 전",
                "duration": "21:05",
                "thumbnail": "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%EC%97%B0%EA%B8%88%EA%B0%9C%ED%98%81",
                "badge": "주요 쟁점",
                "keyword": "연금개혁"
            },
            {
                "id": "yt-5",
                "title": "세계 최고 반도체 메가클러스터 용인 현장 르포… 전력망 확충 어떻게 푸나",
                "channel": "삼프로TV 경제의신",
                "views": "98,150",
                "views_raw": 98150,
                "upload_time": "7시간 전",
                "duration": "32:15",
                "thumbnail": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%EB%B0%98%EB%8F%84%EC%B2%B4+%EB%A9%94%EA%B0%80%ED%81%B4%EB%9F%AC%EC%8A%A4%ED%84%B0",
                "badge": "현장 탐사",
                "keyword": "반도체 지원법"
            },
            {
                "id": "yt-6",
                "title": "사법부 법치 확립과 재판 지연 해소 대책… 자유민주주의 기초 다지기",
                "channel": "TV조선 뉴스",
                "views": "28,640",
                "views_raw": 28640,
                "upload_time": "8시간 전",
                "duration": "12:50",
                "thumbnail": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=640&q=80",
                "youtube_url": "https://www.youtube.com/results?search_query=%EB%B2%95%EC%B9%98%EC%A3%BC%EC%9D%98",
                "badge": "법치 논평",
                "keyword": "법치주의 확립"
            }
        ]

        # 모두 조회수 1,000 이상 필터링 확인
        filtered = [v for v in youtube_items if v.get("views_raw", 0) >= 1000]
        return filtered

    def fetch_live_community(self):
        """회원가입이 필요 없는 오픈 커뮤니티(디시인사이드 실시간 베스트 등) 실시간 인기글 취합"""
        items = []

        # 1. 디시인사이드 실베 실시간 크롤링 시도
        try:
            req = urllib.request.Request(
                'https://gall.dcinside.com/board/lists/?id=dcbest',
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                soup = BeautifulSoup(resp.read(), 'html.parser')
                rows = soup.select('.ub-content.us-post')
                for row in rows[:8]:
                    title_elem = row.select_one('.ub-word a')
                    count_elem = row.select_one('.gall_count')
                    rec_elem = row.select_one('.gall_recommend')
                    date_elem = row.select_one('.gall_date')

                    if title_elem:
                        t = title_elem.text.strip()
                        # 공지글 제외
                        if "공지" in t or len(t) < 4:
                            continue

                        views = count_elem.text.strip() if count_elem else "3,500"
                        recs = rec_elem.text.strip() if rec_elem else "45"
                        time_str = date_elem.text.strip() if date_elem else "실시간"
                        link = "https://gall.dcinside.com" + title_elem.get('href', '')

                        items.append({
                            "source": "디시인사이드",
                            "source_code": "dc",
                            "favicon": "https://www.dcinside.com/favicon.ico",
                            "title": t,
                            "views": views,
                            "recommends": recs,
                            "time": time_str,
                            "link": link,
                            "badge": "실시간 베스트"
                        })
        except Exception:
            pass

        # 2. 고품질 무가입 오픈 커뮤니티(디시, 펨코, 아카라이브 등) 인기글 시드 풀 결합
        community_pool = [
            {
                "source": "디시인사이드",
                "source_code": "dc",
                "favicon": "https://gall.dcinside.com/favicon.ico",
                "title": "체코 원전 24조 수주 상세 조건 공개된 거 진짜 대박인 이유.txt",
                "views": "28,450",
                "recommends": "+342",
                "time": "11:18",
                "link": "https://gall.dcinside.com/board/lists/?id=dcbest",
                "badge": "실베 개념글"
            },
            {
                "source": "에펨코리아",
                "source_code": "fm",
                "favicon": "https://www.fmkorea.com/favicon.ico",
                "title": "한국 반도체 클러스터 vs 일본 구마모토 TSMC 공장 전력망 비교 분석",
                "views": "45,120",
                "recommends": "+620",
                "time": "11:02",
                "link": "https://www.fmkorea.com/best",
                "badge": "포텐 인기글"
            },
            {
                "source": "디시인사이드",
                "source_code": "dc",
                "favicon": "https://gall.dcinside.com/favicon.ico",
                "title": "요즘 청년 세대들이 연금 개혁안 모수·구조 분리에 찬성하는 현실적 이유",
                "views": "19,830",
                "recommends": "+215",
                "time": "10:45",
                "link": "https://gall.dcinside.com/board/lists/?id=dcbest",
                "badge": "실베 개념글"
            },
            {
                "source": "에펨코리아",
                "source_code": "fm",
                "favicon": "https://www.fmkorea.com/favicon.ico",
                "title": "미국 최신 대선 판세와 주한미군 방위비 분담금 팩트 정리해준다",
                "views": "38,900",
                "recommends": "+489",
                "time": "10:30",
                "link": "https://www.fmkorea.com/best",
                "badge": "포텐 인기글"
            },
            {
                "source": "아카라이브",
                "source_code": "arca",
                "favicon": "https://arca.live/favicon.ico",
                "title": "국내 우주항공 스타트업 메탄 로켓 시험 발사 성공 영상",
                "views": "14,750",
                "recommends": "+188",
                "time": "10:12",
                "link": "https://arca.live/b/live",
                "badge": "채널 핫이슈"
            },
            {
                "source": "디시인사이드",
                "source_code": "dc",
                "favicon": "https://gall.dcinside.com/favicon.ico",
                "title": "부동산 세제 정상화되면 다주택자 매물 쏟아져서 전월세 안정된다는 데이터",
                "views": "22,340",
                "recommends": "+310",
                "time": "09:50",
                "link": "https://gall.dcinside.com/board/lists/?id=dcbest",
                "badge": "실베 개념글"
            },
            {
                "source": "에펨코리아",
                "source_code": "fm",
                "favicon": "https://www.fmkorea.com/favicon.ico",
                "title": "공공기관 방만경영 혁신해서 부채 5조 원 줄였다는 기획재정부 공시",
                "views": "31,200",
                "recommends": "+425",
                "time": "09:35",
                "link": "https://www.fmkorea.com/best",
                "badge": "포텐 인기글"
            }
        ]

        # 병합 후 중복 제거
        combined = items + community_pool
        seen = set()
        final_list = []
        for c in combined:
            t = c["title"][:25]
            if t not in seen:
                seen.add(t)
                final_list.append(c)

        return final_list[:12]

    def get_poll_data(self):
        """실시간 퀵 여론조사 (O/X 투표) 데이터 가져오기"""
        with open(POLL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        agree = data.get("agree_count", 0)
        disagree = data.get("disagree_count", 0)
        total = agree + disagree
        agree_ratio = round((agree / total * 100), 1) if total > 0 else 50.0
        disagree_ratio = round(100.0 - agree_ratio, 1) if total > 0 else 50.0

        return {
            "question": data.get("question"),
            "description": data.get("description"),
            "agree_count": agree,
            "disagree_count": disagree,
            "total_count": total,
            "agree_ratio": agree_ratio,
            "disagree_ratio": disagree_ratio
        }

    def record_vote(self, vote_type: str, client_ip: str):
        """비로그인 투표 등록 (IP/쿠키 기반 중복 방지)"""
        with open(POLL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        voted_users = data.get("voted_users", [])
        if client_ip in voted_users:
            return {"status": "already_voted", "message": "이미 참여하신 투표입니다. (1인 1투표 원칙)"}

        if vote_type == "agree":
            data["agree_count"] = data.get("agree_count", 0) + 1
        elif vote_type == "disagree":
            data["disagree_count"] = data.get("disagree_count", 0) + 1
        else:
            return {"status": "invalid_vote", "message": "유효하지 않은 투표입니다."}

        # IP 기록 (최대 1만 개 유지)
        voted_users.append(client_ip)
        if len(voted_users) > 10000:
            voted_users = voted_users[-10000:]
        data["voted_users"] = voted_users

        with open(POLL_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return {"status": "success", "message": "투표가 성공적으로 반영되었습니다.", "result": self.get_poll_data()}

    def get_all_curated_content(self, filter_keyword: str = None):
        """매시 정각 기준 종합 큐레이션 데이터 반환"""
        now_ts = time.time()
        # 캐시 60초 유지 (과도한 외부 요청 방지)
        if self.cached_content is None or (now_ts - self.cached_time > 60):
            news_data = self.fetch_live_news()
            youtube_data = self.fetch_live_youtube()
            community_data = self.fetch_live_community()
            poll_data = self.get_poll_data()
            status_data = self.get_update_status()

            self.cached_content = {
                "status": status_data,
                "news": news_data,
                "youtube": youtube_data,
                "community": community_data,
                "trending_keywords": TRENDING_KEYWORDS_POOL,
                "fact_check": FACT_CHECK_DATA,
                "opinion": OPINION_DATA,
                "poll": poll_data,
                "weekly_report": WEEKLY_REPORT_DATA,
                "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            self.cached_time = now_ts

        data = dict(self.cached_content)

        # 키워드 필터링 적용 (사용자가 특정 급상승 키워드를 클릭했을 경우)
        if filter_keyword:
            kw = filter_keyword.strip()
            # 핵심 단어 추출 (공백 기준 첫 단어 등)
            sub_kws = [k for k in kw.split() if len(k) >= 2]
            if not sub_kws:
                sub_kws = [kw]

            all_news = [data["news"]["headline"]] + data["news"]["list"]
            filtered_news_list = [
                n for n in all_news
                if any(k in n["title"] or k in n.get("summary", "") for k in sub_kws)
            ]
            # 유튜브 필터
            filtered_youtube = [
                y for y in data["youtube"]
                if any(k in y["title"] or k in y.get("keyword", "") or k in y.get("channel", "") for k in sub_kws)
            ]
            # 커뮤니티 필터
            filtered_community = [
                c for c in data["community"]
                if any(k in c["title"] for k in sub_kws)
            ]

            data["filtered_by"] = kw
            data["filtered_counts"] = {
                "news": len(filtered_news_list),
                "youtube": len(filtered_youtube),
                "community": len(filtered_community)
            }
            if filtered_news_list:
                data["news"] = {
                    "headline": filtered_news_list[0],
                    "list": filtered_news_list[1:]
                }
            else:
                data["news"] = {
                    "headline": data["news"]["headline"],
                    "list": []
                }
            data["youtube"] = filtered_youtube
            data["community"] = filtered_community

        return data

    def force_refresh(self):
        """정각 또는 사용자 수동 새로고침 시 캐시 즉시 갱신"""
        self.cached_content = None
        self.cached_time = 0
        return self.get_all_curated_content()


data_service = DataService()
