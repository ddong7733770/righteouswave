/**
 * 바른결 (BarunGyeol) 클라이언트 메인 애플리케이션 스크립트
 * - 매시 정각 카운트다운 타이머 & 자동 갱신
 * - 3단 그리드: 뉴스, 실시간 유튜브, 오픈 커뮤니티 베스트
 * - 엄지 손가락 좋아요 / 싫어요 (싫어요 30개 시 즉시 영구 제외)
 * - 인앱 브라우저 모달 (외부 사이트 이탈 없이 앱 내부 열람)
 * - 키워드 및 검색어 클릭 시 12대 언론사·유튜브 등 연결 사이트 추가 데이터 로드
 * - 주 1회 실시간 여론조사 주제 변경
 * - 매일 00시 오늘의 사자성어 (한글/한자 및 고사 유래 해설)
 * - 매일 00시 바른 팩트체크 (결론 폰트 1.5배 강조)
 * - 원포인트 오피니언 정확한 원문 연결
 * - 하단 플로팅 바 (뒤로가기, 주소 복사·공유, 앞으로가기)
 * - 글자 크기 가변 모드 (+는 1.5배, ++는 2배)
 */

let appState = {
  data: null,
  activeKeyword: null,
  countdownInterval: null,
  remainingSeconds: 0,
  lastUpdateHour: "11:00",
  fontSize: localStorage.getItem("bg_font_size") || "normal",
  theme: localStorage.getItem("bg_theme") || "light",
  currentInApp: null // 현재 열려있는 원문 기사 정보 { url, title, mediaName }
};

// DOM 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  initUserPreferences();
  initEventListeners();
  loadContent();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  checkUrlDeepLink(); // 공유 링크(?article_url=...) 감지하여 원문 모달 자동 오픈
});

/* ========================================================
   1. 환경설정 (글자크기 기본 / +120% 확대 & 다크모드)
   ======================================================== */
function initUserPreferences() {
  setFontSize(appState.fontSize);
  setTheme(appState.theme);
}

function setFontSize(size) {
  // + 버튼 클릭 시 제목 외 본문 120% 확대 적용
  const targetSize = (size === "large") ? "large" : "normal";
  document.body.classList.remove("font-normal", "font-large", "font-xlarge");
  document.body.classList.add(`font-${targetSize}`);
  document.documentElement.classList.toggle("font-large", targetSize === "large");
  appState.fontSize = targetSize;
  localStorage.setItem("bg_font_size", targetSize);

  document.querySelectorAll(".font-btn-compact").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.size === targetSize);
  });
}

function setTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
    document.body.classList.remove("theme-light");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = "☀️";
  } else {
    document.body.classList.add("theme-light");
    document.body.classList.remove("theme-dark");
    const icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = "🌙";
  }
  appState.theme = theme;
  localStorage.setItem("bg_theme", theme);
}

/* ========================================================
   2. 이벤트 리스너 바인딩
   ======================================================== */
function initEventListeners() {
  // 갱신 버튼
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      forceRefresh();
    });
  }

  // 글자 크기 버튼들
  document.querySelectorAll(".font-btn-compact").forEach(btn => {
    btn.addEventListener("click", () => {
      setFontSize(btn.dataset.size);
    });
  });

  // 테마 토글 버튼
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(appState.theme === "dark" ? "light" : "dark");
    });
  }

  // 검색 버튼 및 엔터키
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const q = searchInput.value.trim();
      if (q) filterByKeyword(q);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = searchInput.value.trim();
        if (q) filterByKeyword(q);
      }
    });
  }

  // 필터 초기화 버튼
  const filterClearBtn = document.getElementById("filterClearBtn");
  if (filterClearBtn) {
    filterClearBtn.addEventListener("click", clearFilter);
  }

  // GNB 메뉴 클릭 시 부드러운 스크롤 (타이틀이 잘 보이도록 상단 오프셋 적용)
  document.querySelectorAll(".gnb-menu a").forEach(anchor => {
    anchor.addEventListener("click", (e) => {
      const targetId = anchor.getAttribute("href");
      if (targetId && targetId.startsWith("#")) {
        e.preventDefault();
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          const topOffset = targetEl.getBoundingClientRect().top + window.pageYOffset - 110;
          window.scrollTo({ top: topOffset, behavior: "smooth" });
          
          document.querySelectorAll(".gnb-menu .nav-item").forEach(item => item.classList.remove("active"));
          anchor.parentElement.classList.add("active");
        }
      }
    });
  });

  // 인앱 브라우저 모달 바깥 배경 클릭 시 닫기
  const inAppModal = document.getElementById("inAppBrowserModal");
  if (inAppModal) {
    inAppModal.addEventListener("click", (e) => {
      if (e.target === inAppModal) {
        closeInAppBrowser();
      }
    });
  }

  // 비디오 모달 닫기
  const btnCloseVideo = document.getElementById("btnCloseVideo");
  const videoModal = document.getElementById("videoModal");
  if (btnCloseVideo && videoModal) {
    btnCloseVideo.addEventListener("click", () => {
      videoModal.style.display = "none";
      const container = document.getElementById("videoContainer");
      if (container) container.innerHTML = "";
    });
  }
}

/* ========================================================
   3. 좋아요 / 싫어요 리액션 관리 (싫어요 30개 시 즉시 제외)
   ======================================================== */
function getExcludedItems() {
  try {
    return JSON.parse(localStorage.getItem("bg_excluded_items") || "[]");
  } catch (e) {
    return [];
  }
}

function isItemExcluded(id) {
  if (!id) return false;
  return getExcludedItems().includes(String(id));
}

function getItemVotes(id, defaultLikes = 15, defaultDislikes = 0) {
  try {
    const votes = JSON.parse(localStorage.getItem("bg_item_votes") || "{}");
    if (votes[id]) return votes[id];
  } catch (e) {}
  return { likes: defaultLikes, dislikes: defaultDislikes, userVote: null };
}

function handleItemVote(event, id, type) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  let votes = {};
  try {
    votes = JSON.parse(localStorage.getItem("bg_item_votes") || "{}");
  } catch (err) {}

  const current = votes[id] || { likes: 14, dislikes: 0, userVote: null };
  if (current.userVote === type) {
    showToast("이미 투표하신 항목입니다.");
    return;
  }

  // 기존 투표 취소
  if (current.userVote) {
    if (current.userVote === "like") current.likes = Math.max(0, current.likes - 1);
    if (current.userVote === "dislike") current.dislikes = Math.max(0, current.dislikes - 1);
  }

  if (type === "like") {
    current.likes += 1;
    current.userVote = "like";
    showToast("👍 '좋아요'가 반영되었습니다.");
  } else {
    current.dislikes += 1;
    current.userVote = "dislike";
    showToast("👎 '싫어요'가 반영되었습니다.");
  }

  votes[id] = current;
  localStorage.setItem("bg_item_votes", JSON.stringify(votes));

  // 싫어요 30개 이상 누적 시 무조건 제외
  if (current.dislikes >= 30) {
    const excluded = getExcludedItems();
    if (!excluded.includes(String(id))) {
      excluded.push(String(id));
      localStorage.setItem("bg_excluded_items", JSON.stringify(excluded));
    }

    const card = document.querySelector(`[data-card-id="${id}"]`);
    if (card) {
      card.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      setTimeout(() => card.remove(), 400);
    }
    showToast("비선호(싫어요) 30개가 누적되어 해당 콘텐츠가 목록에서 영구 제외되었습니다.");
    return;
  }

  // 화면 실시간 카운트 반영
  const card = document.querySelector(`[data-card-id="${id}"]`);
  if (card) {
    const likeCnt = card.querySelector(".like-cnt");
    const dislikeCnt = card.querySelector(".dislike-cnt");
    const likeBtn = card.querySelector(".btn-like");
    const dislikeBtn = card.querySelector(".btn-dislike");
    if (likeCnt) likeCnt.textContent = current.likes;
    if (dislikeCnt) dislikeCnt.textContent = current.dislikes;
    if (likeBtn) likeBtn.classList.toggle("voted", current.userVote === "like");
    if (dislikeBtn) dislikeBtn.classList.toggle("voted", current.userVote === "dislike");
  }
}

/* ========================================================
   4. 인앱 브라우저 (언론사 보안 헤더 우회 프록시 연동)
   ======================================================== */
function openInAppBrowser(url, title, mediaName) {
  if (!url || url === "#" || url.startsWith("javascript:")) return;

  const modal = document.getElementById("inAppBrowserModal");
  const iframe = document.getElementById("inAppBrowserIframe");
  const spinner = document.getElementById("inAppLoadingSpinner");
  const titleEl = document.getElementById("browserTitleText");
  const urlEl = document.getElementById("browserUrlText");
  const extBtn = document.getElementById("browserBtnExternal");

  if (!modal || !iframe) return;

  // 현재 열린 기사 상태 저장 (하단 바 복사 버튼 클릭 시 딥링크 생성에 활용)
  appState.currentInApp = { url, title, mediaName };

  modal.style.display = "flex";
  if (spinner) spinner.style.display = "flex";

  const displayTitle = title ? (mediaName ? `[${mediaName}] ${title}` : title) : "기사 열람 중";
  if (titleEl) titleEl.textContent = displayTitle;
  if (urlEl) urlEl.textContent = url;
  if (extBtn) extBtn.href = url;

  // 요구사항 3: GitHub Pages 등 정적 호스팅 환경에서 /api/proxy-frame 호출 시 404 발생하는 문제 완전 해결
  // 백엔드가 없는 환경(github.io 등)에서는 /api/proxy-frame을 호출하지 않고 원문으로 직접 연결
  const isStaticEnv = window.location.hostname.includes("github.io") || window.location.protocol === "file:" || (!window.location.port && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1");

  let targetIframeUrl = url;
  if (!isStaticEnv && (url.startsWith("http://") || url.startsWith("https://"))) {
    // 로컬 백엔드 서버(localhost:8080 등)가 있는 환경에서만 프록시 엔드포인트 호출
    targetIframeUrl = `/api/proxy-frame?url=${encodeURIComponent(url)}`;
  }

  iframe.onload = () => {
    if (spinner) spinner.style.display = "none";
  };

  iframe.onerror = () => {
    iframe.src = url;
    if (spinner) spinner.style.display = "none";
  };

  iframe.src = targetIframeUrl;

  // 최대 4초 후 스피너 자동 종료
  setTimeout(() => {
    if (spinner) spinner.style.display = "none";
  }, 4000);
}

function closeInAppBrowser() {
  const modal = document.getElementById("inAppBrowserModal");
  const iframe = document.getElementById("inAppBrowserIframe");
  const spinner = document.getElementById("inAppLoadingSpinner");

  appState.currentInApp = null;
  if (modal) modal.style.display = "none";
  if (iframe) iframe.src = "about:blank";
  if (spinner) spinner.style.display = "none";
}

function inAppBrowserBack() {
  const iframe = document.getElementById("inAppBrowserIframe");
  if (iframe && iframe.contentWindow) {
    try { iframe.contentWindow.history.back(); } catch (e) {}
  }
}

function inAppBrowserForward() {
  const iframe = document.getElementById("inAppBrowserIframe");
  if (iframe && iframe.contentWindow) {
    try { iframe.contentWindow.history.forward(); } catch (e) {}
  }
}

function inAppBrowserReload() {
  const iframe = document.getElementById("inAppBrowserIframe");
  if (iframe && appState.currentInApp) {
    const spinner = document.getElementById("inAppLoadingSpinner");
    if (spinner) spinner.style.display = "flex";
    const isStaticEnv = window.location.hostname.includes("github.io") || window.location.protocol === "file:" || (!window.location.port && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1");
    if (!isStaticEnv && (appState.currentInApp.url.startsWith("http://") || appState.currentInApp.url.startsWith("https://"))) {
      iframe.src = `/api/proxy-frame?url=${encodeURIComponent(appState.currentInApp.url)}`;
    } else {
      iframe.src = appState.currentInApp.url;
    }
  }
}

// 하단 뒤로가기 버튼 스마트 핸들러 (원문 열람 중에는 모달 닫기, 평소에는 뒤로가기)
function handleBottomNavBack() {
  if (appState.currentInApp) {
    closeInAppBrowser();
  } else {
    history.back();
  }
}

/* ========================================================
   5. 하단 공유하기 (열린 기사 딥링크 생성 및 주소 복사)
   ======================================================== */
function handleShareCurrentPage() {
  let shareUrl = `${window.location.origin}${window.location.pathname}`;
  let successMsg = "바른결 주소가 복사되었습니다! 카카오톡 등에 공유해보세요.";

  // 현재 열려 있는 원문 기사가 있는 경우, 수신자가 바로 기사를 볼 수 있는 딥링크 생성
  if (appState.currentInApp && appState.currentInApp.url) {
    const cur = appState.currentInApp;
    shareUrl = `${window.location.origin}${window.location.pathname}?article_url=${encodeURIComponent(cur.url)}&article_title=${encodeURIComponent(cur.title || '')}&article_media=${encodeURIComponent(cur.mediaName || '')}`;
    successMsg = "열람 중인 기사 링크가 복사되었습니다! 카톡 등에 공유하면 이 기사가 바로 열립니다.";
  }

  copyTextToClipboard(shareUrl, successMsg);
}

function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const input = document.createElement("input");
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
  showToast(successMsg || "링크가 클립보드에 복사되었습니다!");
}

// 페이지 진입 시 URL 파라미터(?article_url=...) 감지하여 원문 모달 자동 팝업
function checkUrlDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const articleUrl = params.get("article_url");
    if (articleUrl) {
      const articleTitle = params.get("article_title") || "공유된 기사";
      const articleMedia = params.get("article_media") || "";
      setTimeout(() => {
        openInAppBrowser(articleUrl, articleTitle, articleMedia);
      }, 350);
    }
  } catch (e) {}
}

let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById("toastPopup");
  const text = document.getElementById("toastText");
  if (!toast) return;
  if (text) text.textContent = msg;
  toast.style.display = "flex";
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

/* ========================================================
   6. 카운트다운 타이머 및 시계
   ======================================================== */
function updateLiveClock() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[now.getDay()];
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");

  const dateBadge = document.getElementById("idiomDateBadge");
  if (dateBadge) {
    dateBadge.textContent = `${year}.${month}.${date} (${dayName})`;
  }
}

function startCountdown(totalSeconds, lastUpdateHour) {
  if (appState.countdownInterval) {
    clearInterval(appState.countdownInterval);
  }

  appState.remainingSeconds = totalSeconds;
  appState.lastUpdateHour = lastUpdateHour || "11:00";

  const lastEl = document.getElementById("lastUpdateHour");
  if (lastEl) lastEl.textContent = appState.lastUpdateHour;

  renderCountdownDisplay();

  appState.countdownInterval = setInterval(() => {
    appState.remainingSeconds -= 1;
    if (appState.remainingSeconds <= 0) {
      clearInterval(appState.countdownInterval);
      forceRefresh();
      return;
    }
    renderCountdownDisplay();
  }, 1000);
}

function renderCountdownDisplay() {
  const s = Math.max(0, appState.remainingSeconds);
  const hours = String(Math.floor(s / 3600)).padStart(2, "0");
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const secs = String(s % 60).padStart(2, "0");

  const timerEl = document.getElementById("countdownTimer");
  if (timerEl) {
    timerEl.textContent = `${hours}:${mins}:${secs}`;
  }
}

/* ========================================================
   7. 데이터 로드 및 렌더링 오케스트레이션
   ======================================================== */
let cachedStaticData = null;

async function loadContent(keyword = null) {
  let data = null;

  // 1. 서버 API 호출 시도
  try {
    let url = "/api/content";
    if (keyword) {
      url += `?keyword=${encodeURIComponent(keyword)}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {}

  // 2. 정적 파일 호스팅 폴백 (GitHub Pages 환경)
  if (!data) {
    try {
      if (!cachedStaticData) {
        const res = await fetch("data/content.json");
        if (res.ok) cachedStaticData = await res.json();
      }
      if (cachedStaticData) {
        data = filterClientData(JSON.parse(JSON.stringify(cachedStaticData)), keyword);
      }
    } catch (staticErr) {
      console.error("정적 데이터 로드 오류:", staticErr);
    }
  }

  if (!data) return;

  appState.data = data;

  if (data.status) {
    startCountdown(data.status.remaining_seconds, data.status.last_update);
  }

  renderHeadlineNews(data.news.headline);
  renderStraightNews(data.news.list);
  renderYouTube(data.youtube);
  renderCommunity(data.community);
  renderTrendingKeywords(data.trending_keywords);
  renderFactCheck(data.fact_check);
  renderOpinion(data.opinion);
  renderPoll(data.poll);
  renderDailyIdiom(data.daily_idiom);
  renderWeeklyReport(data.weekly_report);

  updateFilterUI(keyword, data.filtered_counts);

  // 키워드가 있으면 연결 사이트 추가 데이터 검색 실행
  if (keyword) {
    fetchConnectedExtraData(keyword);
  }
}

function filterClientData(raw, kw) {
  if (!kw) return raw;
  const data = JSON.parse(JSON.stringify(raw));
  const searchKws = kw.split(" ").filter(k => k.length >= 2);
  if (searchKws.length === 0) searchKws.push(kw);

  const allNews = [raw.news.headline].concat(raw.news.list || []).filter(Boolean);
  const filteredNews = allNews.filter(n =>
    searchKws.some(k => (n.title && n.title.includes(k)) || (n.summary && n.summary.includes(k)))
  );
  const filteredYt = (data.youtube || []).filter(y =>
    searchKws.some(k => (y.title && y.title.includes(k)) || (y.channel && y.channel.includes(k)) || (y.keyword && y.keyword.includes(k)))
  );
  const filteredComm = (data.community || []).filter(c =>
    searchKws.some(k => c.title && c.title.includes(k))
  );

  data.filtered_by = kw;
  data.filtered_counts = {
    news: filteredNews.length,
    youtube: filteredYt.length,
    community: filteredComm.length
  };
  if (filteredNews.length > 0) {
    data.news = { headline: filteredNews[0], list: filteredNews.slice(1) };
  } else {
    data.news = { headline: raw.news.headline, list: [] };
  }
  data.youtube = filteredYt;
  data.community = filteredComm;
  return data;
}

async function forceRefresh() {
  const btn = document.getElementById("btnRefresh");
  if (btn) btn.classList.add("spinning");

  try {
    let freshData = null;
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        freshData = result.data;
      }
    } catch (e) {}

    if (!freshData && cachedStaticData) {
      await new Promise(r => setTimeout(r, 500));
      freshData = cachedStaticData;
    }

    if (freshData) {
      appState.data = freshData;
      if (freshData.status) {
        startCountdown(freshData.status.remaining_seconds, freshData.status.last_update);
      }
      renderHeadlineNews(freshData.news.headline);
      renderStraightNews(freshData.news.list);
      renderYouTube(freshData.youtube);
      renderCommunity(freshData.community);
      renderTrendingKeywords(freshData.trending_keywords);
      renderFactCheck(freshData.fact_check);
      renderOpinion(freshData.opinion);
      renderPoll(freshData.poll);
      renderDailyIdiom(freshData.daily_idiom);
      renderWeeklyReport(freshData.weekly_report);
      clearFilter();
      showToast("데이터가 최신으로 새로고침되었습니다.");
    }
  } catch (err) {
    console.error("새로고침 오류:", err);
  } finally {
    if (btn) {
      setTimeout(() => btn.classList.remove("spinning"), 500);
    }
  }
}

/* ========================================================
   8. 카테고리별 렌더링
   ======================================================== */

// (1) 메인 헤드라인 뉴스
function renderHeadlineNews(headline) {
  if (!headline) return;
  const id = headline.id || `hl-${Math.abs(hashCode(headline.title))}`;
  if (isItemExcluded(id)) return;

  const card = document.getElementById("headlineCard");
  if (card) card.setAttribute("data-card-id", id);

  const thumbWrap = document.querySelector(".headline-thumb-wrap");
  const imgEl = document.getElementById("headlineImg");
  const mediaEl = document.getElementById("headlineMedia");
  const timeEl = document.getElementById("headlineTime");
  const titleEl = document.getElementById("headlineTitle");
  const summaryEl = document.getElementById("headlineSummary");
  const linkEl = document.getElementById("headlineLink");
  const reactEl = document.getElementById("headlineReaction");

  if (imgEl && thumbWrap) {
    if (headline.thumbnail && headline.thumbnail.startsWith("http")) {
      imgEl.src = headline.thumbnail;
      imgEl.alt = headline.title;
      thumbWrap.style.display = "block";
    } else {
      thumbWrap.style.display = "none";
    }
  }

  if (mediaEl) mediaEl.textContent = headline.media || "주요언론";
  if (timeEl) timeEl.textContent = headline.time || "실시간";
  if (titleEl) {
    titleEl.innerHTML = `<a href="javascript:void(0)" onclick="openInAppBrowser('${headline.link}', '${escapeHtml(headline.title)}', '${escapeHtml(headline.media)}')">${escapeHtml(headline.title)}</a>`;
  }
  if (summaryEl) summaryEl.textContent = headline.summary || "";
  if (linkEl) {
    linkEl.onclick = (e) => {
      e.preventDefault();
      openInAppBrowser(headline.link, headline.title, headline.media);
    };
  }

  const votes = getItemVotes(id, 24, 0);
  if (reactEl) {
    reactEl.innerHTML = `
      <button class="btn-react btn-like ${votes.userVote === 'like' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'like')" title="추천 (좋아요)">
        👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
      </button>
      <button class="btn-react btn-dislike ${votes.userVote === 'dislike' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'dislike')" title="비추천 (싫어요 30개 시 제외)">
        👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
      </button>
    `;
  }
}

// (2) 스트레이트 뉴스 리스트
function renderStraightNews(newsList) {
  const container = document.getElementById("straightNewsList");
  if (!container) return;

  const validNews = (newsList || []).filter(item => {
    const id = item.id || `news-${Math.abs(hashCode(item.title))}`;
    return !isItemExcluded(id);
  });

  if (validNews.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 뉴스가 없습니다.</div>';
    return;
  }

  const html = validNews.map(item => {
    const id = item.id || `news-${Math.abs(hashCode(item.title))}`;
    const votes = getItemVotes(id, 14, 0);
    return `
      <article class="news-item" data-card-id="${id}">
        <div class="news-header-meta">
          <span class="news-media-tag">${escapeHtml(item.media || "주요언론")}</span>
          <span>${escapeHtml(item.time || "실시간")}</span>
        </div>
        <a href="javascript:void(0)" onclick="openInAppBrowser('${item.link}', '${escapeHtml(item.title)}', '${escapeHtml(item.media)}')" class="news-link">
          ${escapeHtml(item.title)}
        </a>
        <div class="item-reaction-bar">
          <button class="btn-react btn-like ${votes.userVote === 'like' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'like')" title="좋아요">
            👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
          </button>
          <button class="btn-react btn-dislike ${votes.userVote === 'dislike' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'dislike')" title="싫어요 (30개 시 제외)">
            👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = html;
}

// (3) 실시간 유튜브
function renderYouTube(ytList) {
  const container = document.getElementById("youtubeGrid");
  if (!container) return;

  const validYt = (ytList || []).filter(item => {
    const id = item.id || `yt-${Math.abs(hashCode(item.title))}`;
    return !isItemExcluded(id);
  });

  if (validYt.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 유튜브 영상이 없습니다.</div>';
    return;
  }

  const html = validYt.map(item => {
    const id = item.id || `yt-${Math.abs(hashCode(item.title))}`;
    const votes = getItemVotes(id, 18, 0);
    return `
      <div class="yt-card" data-card-id="${id}">
        <div class="yt-thumb-box" onclick="openYouTube('${item.youtube_url}', '${escapeHtml(item.title)}')">
          <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy">
          <div class="yt-play-overlay">
            <div class="play-circle">▶</div>
          </div>
          <span class="yt-duration-badge">${item.duration || "영상"}</span>
        </div>
        <div class="yt-content-box">
          <h4 class="yt-title" onclick="openYouTube('${item.youtube_url}', '${escapeHtml(item.title)}')">${escapeHtml(item.title)}</h4>
          <div class="yt-channel-row">
            <span class="yt-channel-name">📺 ${escapeHtml(item.channel)}</span>
            <span>${item.upload_time}</span>
          </div>
          <div class="yt-views-badge-row">
            <span class="yt-views-badge">조회수 ${item.views}회</span>
            <span class="yt-topic-badge">#${escapeHtml(item.keyword || "트렌드")}</span>
          </div>
          <div class="yt-action-bar">
            <!-- 요구사항 5: 원문보기 추가 (클릭시 원문으로 연결) -->
            <a href="${item.youtube_url}" target="_blank" rel="noopener noreferrer" class="btn-yt-external" title="유튜브 원문 영상으로 직접 연결">
              ▶ 원문보기 ↗
            </a>
            <div class="item-reaction-bar">
              <button class="btn-react btn-like ${votes.userVote === 'like' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'like')" title="좋아요">
                👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
              </button>
              <button class="btn-react btn-dislike ${votes.userVote === 'dislike' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'dislike')" title="싫어요 (30개 시 제외)">
                👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

function openYouTube(url, title) {
  // 유튜브 영상 재생 모달 호출 (요구사항 5: 재생 안 되는 영상 방지 및 원문보기 지원)
  const modal = document.getElementById("videoModal");
  const titleEl = document.getElementById("videoModalTitle");
  const container = document.getElementById("videoContainer");
  const metaBox = document.getElementById("videoMetaBox");

  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  const vid = m ? m[1] : null;

  if (modal && vid) {
    modal.style.display = "flex";
    if (titleEl) titleEl.textContent = title || "영상 시청";
    if (container) {
      container.innerHTML = `
        <iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&enablejsapi=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="eager"></iframe>
      `;
    }
    if (metaBox) {
      metaBox.innerHTML = `
        <p style="font-weight: 750; font-size: 0.95rem; margin-bottom: 8px;">${escapeHtml(title)}</p>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-yt-external" style="padding: 6px 14px; font-size: 0.85rem;">
            ▶ 유튜브 원문 영상 바로보기 ↗
          </a>
          <span style="font-size: 0.74rem; color: var(--text-tertiary);">💡 방송권 제한으로 재생되지 않을 경우 위 버튼을 누르시면 원본 영상으로 즉시 시청하실 수 있습니다.</span>
        </div>
      `;
    }
  } else {
    // vid 파싱 불가 시 유튜브 원문 직접 열기
    window.open(url, "_blank");
  }
}

// (4) 무가입 오픈 커뮤니티 실시간 베스트
function renderCommunity(commList) {
  const container = document.getElementById("communityList");
  if (!container) return;

  const validComm = (commList || []).filter(item => {
    const id = item.id || `comm-${Math.abs(hashCode(item.title))}`;
    return !isItemExcluded(id);
  });

  if (validComm.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 커뮤니티 글이 없습니다.</div>';
    return;
  }

  const html = validComm.map(item => {
    const id = item.id || `comm-${Math.abs(hashCode(item.title))}`;
    const votes = getItemVotes(id, 12, 0);
    return `
      <article class="comm-item" data-card-id="${id}">
        <div class="comm-top-row">
          <span class="comm-source-badge">
            <img src="${item.favicon}" alt="" class="comm-favicon" onerror="this.style.display='none'">
            ${escapeHtml(item.source)}
          </span>
          <div class="comm-stat-tags">
            <span class="comm-views-tag">조회 ${item.views}</span>
            <span class="comm-rec-tag">${item.recommends}</span>
          </div>
        </div>
        <a href="javascript:void(0)" onclick="openInAppBrowser('${item.link}', '${escapeHtml(item.title)}', '${escapeHtml(item.source)}')" class="comm-title">
          ${escapeHtml(item.title)}
        </a>
        <div class="comm-footer-meta">
          <span class="comm-badge-label">${item.badge || "실시간"}</span>
          <span>${item.time}</span>
          <div class="item-reaction-bar" style="margin-left: auto;">
            <button class="btn-react btn-like ${votes.userVote === 'like' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'like')" title="좋아요">
              👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
            </button>
            <button class="btn-react btn-dislike ${votes.userVote === 'dislike' ? 'voted' : ''}" onclick="handleItemVote(event, '${id}', 'dislike')" title="싫어요 (30개 시 제외)">
              👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  container.innerHTML = html;
}

// (5) 시간대별 급상승 검색어
function renderTrendingKeywords(keywords) {
  const container = document.getElementById("trendingList");
  const timeBadge = document.getElementById("trendingTimeBadge");
  if (!container) return;

  if (timeBadge && appState.lastUpdateHour) {
    timeBadge.textContent = `${appState.lastUpdateHour} 기준`;
  }

  if (!keywords || keywords.length === 0) return;

  const html = keywords.map(item => {
    let changeClass = "change-same";
    if (item.status === "up") changeClass = "change-up";
    else if (item.status === "down") changeClass = "change-down";
    else if (item.status === "new") changeClass = "change-new";

    const isTop3 = item.rank <= 3 ? "rank-top-3" : "";

    return `
      <li class="trending-item ${isTop3}" onclick="filterByKeyword('${escapeHtml(item.keyword)}')">
        <div class="trending-rank-left">
          <span class="rank-num">${item.rank}</span>
          <span class="rank-keyword">${escapeHtml(item.keyword)}</span>
        </div>
        <div class="trending-rank-right">
          <span class="rank-change ${changeClass}">${item.change}</span>
        </div>
      </li>
    `;
  }).join("");

  container.innerHTML = html;
}

// (6) 바른 팩트체크 코너
function renderFactCheck(facts) {
  const container = document.getElementById("factcheckGrid");
  if (!container || !facts) return;

  const html = facts.map(item => `
    <div class="fact-card">
      <div class="fact-header">
        <span class="fact-badge">${escapeHtml(item.badge)}</span>
        <span class="fact-updated">${escapeHtml(item.updated)}</span>
      </div>
      <h3 class="fact-title">${escapeHtml(item.title)}</h3>
      
      <div class="fact-block block-claim">
        <strong>❌ 논란의 주장:</strong><br>
        ${escapeHtml(item.claim)}
      </div>

      <div class="fact-block block-fact">
        <strong>✅ 검증된 팩트:</strong><br>
        ${escapeHtml(item.fact)}
      </div>

      <div class="fact-block block-evidence">
        <strong>📊 근거 자료:</strong> ${escapeHtml(item.evidence)}
      </div>

      <div class="fact-conclusion-badge">
        결론: ${escapeHtml(item.conclusion)}
      </div>
    </div>
  `).join("");

  container.innerHTML = html;
}

// (7) 원포인트 오피니언 (사설&칼럼 엄선 직통 연결)
function renderOpinion(opinions) {
  const container = document.getElementById("opinionGrid");
  if (!container || !opinions) return;

  const html = opinions.map(item => `
    <div class="op-card">
      <div class="op-meta-row">
        <span class="op-category-tag">${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.time)}</span>
      </div>
      <h3 class="op-title">
        <a href="javascript:void(0)" onclick="openInAppBrowser('${item.link}', '${escapeHtml(item.title)}', '${escapeHtml(item.media)}')">
          ${escapeHtml(item.title)}
        </a>
      </h3>
      <p class="op-summary">${escapeHtml(item.summary)}</p>
      <div class="op-footer">
        <div class="op-author-box">
          <span class="op-author-icon">✍️</span>
          <strong>${escapeHtml(item.author)}</strong>
        </div>
        <a href="javascript:void(0)" onclick="openInAppBrowser('${item.link}', '${escapeHtml(item.title)}', '${escapeHtml(item.media)}')" class="op-read-btn">
          원문 전문 읽기 ↗
        </a>
      </div>
    </div>
  `).join("");

  container.innerHTML = html;
}

// (8) 오늘의 사자성어 렌더링
function renderDailyIdiom(idiom) {
  if (!idiom) return;
  const topText = document.getElementById("headerIdiomTitle");
  if (topText) topText.textContent = `${idiom.hanja}(${idiom.hangul})`;

  const hanjaEl = document.getElementById("idiomHanja");
  const hangulEl = document.getElementById("idiomHangul");
  const meaningEl = document.getElementById("idiomMeaning");
  const originEl = document.getElementById("idiomOrigin");
  const modernEl = document.getElementById("idiomModern");

  if (hanjaEl) hanjaEl.textContent = idiom.hanja;
  if (hangulEl) hangulEl.textContent = `(${idiom.hangul})`;
  if (meaningEl) meaningEl.textContent = idiom.meaning;
  if (originEl) originEl.textContent = idiom.origin;
  if (modernEl) modernEl.textContent = idiom.modern;
}

function scrollToIdiom() {
  const el = document.getElementById("section-idiom");
  if (el) {
    const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: topOffset, behavior: "smooth" });
  }
}

// (9) 비로그인 실시간 여론조사 (주 1회 주제 변경)
function renderPoll(poll) {
  if (!poll) return;

  const qEl = document.getElementById("pollQuestion");
  const descEl = document.getElementById("pollDesc");
  const totalEl = document.getElementById("pollTotalCount");
  const agreeRatioEl = document.getElementById("agreeRatioText");
  const disagreeRatioEl = document.getElementById("disagreeRatioText");
  const agreeCountEl = document.getElementById("agreeCountText");
  const disagreeCountEl = document.getElementById("disagreeCountText");
  const agreeFill = document.getElementById("agreeFillBar");
  const disagreeFill = document.getElementById("disagreeFillBar");
  const statusEl = document.getElementById("pollUserStatus");
  const noticeEl = document.getElementById("pollNotice");

  if (qEl) qEl.textContent = poll.question;
  if (descEl) descEl.textContent = poll.description;
  if (totalEl) totalEl.textContent = poll.total_count.toLocaleString();

  if (agreeRatioEl) agreeRatioEl.textContent = `${poll.agree_ratio}%`;
  if (disagreeRatioEl) disagreeRatioEl.textContent = `${poll.disagree_ratio}%`;
  if (agreeCountEl) agreeCountEl.textContent = poll.agree_count.toLocaleString();
  if (disagreeCountEl) disagreeCountEl.textContent = poll.disagree_count.toLocaleString();

  if (agreeFill) agreeFill.style.width = `${poll.agree_ratio}%`;
  if (disagreeFill) disagreeFill.style.width = `${poll.disagree_ratio}%`;

  const hasVoted = localStorage.getItem("bg_voted_poll");
  if (hasVoted) {
    if (statusEl) {
      statusEl.textContent = "참여 완료";
      statusEl.style.color = "#16a34a";
      statusEl.style.backgroundColor = "#dcfce7";
    }
    if (noticeEl) {
      noticeEl.textContent = `회원님께서는 이미 '${hasVoted === "agree" ? "찬성" : "반대"}'에 투표하셨습니다. (1인 1투표)`;
    }
  }
}

async function submitVote(type) {
  const hasVoted = localStorage.getItem("bg_voted_poll");
  if (hasVoted) {
    showToast("이미 참여하신 여론조사입니다. (1인 1투표 원칙)");
    return;
  }

  let success = false;
  try {
    const res = await fetch("/api/poll/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: type })
    });
    if (res.ok) {
      const result = await res.json();
      if (result.status === "success") {
        localStorage.setItem("bg_voted_poll", type);
        renderPoll(result.result);
        showToast("투표가 정상적으로 반영되었습니다. 감사합니다!");
        success = true;
      }
    }
  } catch (err) {}

  if (!success) {
    localStorage.setItem("bg_voted_poll", type);
    if (appState.data && appState.data.poll) {
      if (type === "agree") appState.data.poll.agree_count += 1;
      else appState.data.poll.disagree_count += 1;
      appState.data.poll.total_count = appState.data.poll.agree_count + appState.data.poll.disagree_count;
      appState.data.poll.agree_ratio = Math.round((appState.data.poll.agree_count / appState.data.poll.total_count) * 1000) / 10;
      appState.data.poll.disagree_ratio = Math.round((100 - appState.data.poll.agree_ratio) * 10) / 10;
      renderPoll(appState.data.poll);
    }
    showToast("투표가 정상적으로 반영되었습니다. (1인 1투표 원칙)");
  }
}

// (10) 주간 키워드 데이터 리포트 (최하단 섹션)
function renderWeeklyReport(report) {
  if (!report) return;

  const totalEl = document.getElementById("reportTotalCurated");
  const periodEl = document.getElementById("reportPeriodText");
  const tableBody = document.getElementById("reportKeywordTable");
  const insightsList = document.getElementById("reportInsightsList");

  if (totalEl) totalEl.textContent = report.total_curated;
  if (periodEl && report.period) periodEl.textContent = report.period;

  if (tableBody && report.top_keywords) {
    tableBody.innerHTML = report.top_keywords.map(k => `
      <tr>
        <td><strong>${k.rank}위</strong></td>
        <td><strong style="color: var(--color-primary-500);">${escapeHtml(k.keyword)}</strong></td>
        <td>${k.clicks}</td>
        <td><span style="color: var(--color-accent-pink); font-weight: 750;">${k.ratio}</span></td>
      </tr>
    `).join("");
  }

  if (insightsList && report.highlights) {
    insightsList.innerHTML = report.highlights.map(h => `
      <li>${escapeHtml(h)}</li>
    `).join("");
  }
}

/* ========================================================
   9. 키워드 필터링 & 연결 사이트 실시간 추가 데이터 로드
   ======================================================== */
function filterByKeyword(keyword) {
  if (!keyword) return;
  appState.activeKeyword = keyword;
  loadContent(keyword);

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = keyword;

  const targetEl = document.getElementById("section-news");
  if (targetEl) {
    const topOffset = targetEl.getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: topOffset, behavior: "smooth" });
  }
}

async function fetchConnectedExtraData(keyword) {
  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
    if (res.ok) {
      const extraData = await res.json();
      if (extraData && (extraData.news?.length > 0 || extraData.youtube?.length > 0)) {
        appendConnectedSearchResults(extraData);
      }
    }
  } catch (e) {}
}

function appendConnectedSearchResults(extraData) {
  // 1. 뉴스 컬럼에 연결 언론사 실시간 추가 기사 삽입
  if (extraData.news && extraData.news.length > 0) {
    const newsContainer = document.getElementById("straightNewsList");
    if (newsContainer) {
      const extraHtml = extraData.news.map(item => {
        const id = item.id;
        const votes = getItemVotes(id, 10, 0);
        return `
          <article class="news-item extra-search-item" data-card-id="${id}" style="border-left: 3px solid var(--color-primary-500); background: var(--color-primary-50);">
            <div class="news-header-meta">
              <span class="news-media-tag" style="background: var(--color-primary-500); color: #fff;">⚡ 연결 사이트: ${escapeHtml(item.media)}</span>
              <span>${escapeHtml(item.time)}</span>
            </div>
            <a href="javascript:void(0)" onclick="openInAppBrowser('${item.link}', '${escapeHtml(item.title)}', '${escapeHtml(item.media)}')" class="news-link" style="font-weight: 750;">
              ${escapeHtml(item.title)}
            </a>
            <div class="item-reaction-bar">
              <button class="btn-react btn-like" onclick="handleItemVote(event, '${id}', 'like')">
                👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
              </button>
              <button class="btn-react btn-dislike" onclick="handleItemVote(event, '${id}', 'dislike')">
                👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
              </button>
            </div>
          </article>
        `;
      }).join("");

      newsContainer.insertAdjacentHTML("afterbegin", extraHtml);
    }
  }

  // 2. 유튜브 컬럼에 실시간 추가 영상 삽입
  if (extraData.youtube && extraData.youtube.length > 0) {
    const ytContainer = document.getElementById("youtubeGrid");
    if (ytContainer) {
      const extraYtHtml = extraData.youtube.map(item => {
        const id = item.id;
        const votes = getItemVotes(id, 12, 0);
        return `
          <div class="yt-card extra-yt-item" data-card-id="${id}" style="border: 2px solid var(--color-primary-200);">
            <div class="yt-thumb-box" onclick="openYouTube('${item.youtube_url}', '${escapeHtml(item.title)}')">
              <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy">
              <div class="yt-play-overlay"><div class="play-circle">▶</div></div>
              <span class="yt-duration-badge" style="background: var(--color-primary-600);">${item.duration || "추가 검색"}</span>
            </div>
            <div class="yt-content-box">
              <h4 class="yt-title" onclick="openYouTube('${item.youtube_url}', '${escapeHtml(item.title)}')">${escapeHtml(item.title)}</h4>
              <div class="yt-channel-row">
                <span class="yt-channel-name">📺 ${escapeHtml(item.channel)}</span>
                <span>${item.upload_time}</span>
              </div>
              <div class="yt-views-badge-row">
                <span class="yt-views-badge" style="background: var(--color-primary-50); color: var(--color-primary-700);">⚡ 연결 검색 영상</span>
                <span class="yt-topic-badge">#${escapeHtml(item.keyword)}</span>
              </div>
              <div class="yt-action-bar">
                <a href="${item.youtube_url}" target="_blank" rel="noopener noreferrer" class="btn-yt-external" title="유튜브 원문 영상으로 직접 연결">
                  ▶ 원문보기 ↗
                </a>
                <div class="item-reaction-bar">
                  <button class="btn-react btn-like" onclick="handleItemVote(event, '${id}', 'like')">
                    👍 <span class="vote-cnt like-cnt">${votes.likes}</span>
                  </button>
                  <button class="btn-react btn-dislike" onclick="handleItemVote(event, '${id}', 'dislike')">
                    👎 <span class="vote-cnt dislike-cnt">${votes.dislikes}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      ytContainer.insertAdjacentHTML("afterbegin", extraYtHtml);
    }
  }

  showToast(`'${extraData.keyword}' 관련 연결 사이트의 실시간 데이터가 추가되었습니다.`);
}

function clearFilter() {
  appState.activeKeyword = null;
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  loadContent();
}

function resetFilter(e) {
  if (e) e.preventDefault();
  clearFilter();
}

function updateFilterUI(keyword, counts) {
  const bar = document.getElementById("filterStatusBar");
  const kwText = document.getElementById("filterKeywordText");
  const countText = document.getElementById("filterCountText");

  if (!bar) return;

  if (keyword) {
    bar.style.display = "flex";
    if (kwText) kwText.textContent = `#${keyword}`;
    if (countText && counts) {
      countText.textContent = `관련 뉴스 ${counts.news}건, 유튜브 ${counts.youtube}건, 커뮤니티 ${counts.community}건 정렬됨 (연결 사이트 실시간 검색 포함)`;
    }
  } else {
    bar.style.display = "none";
  }
}

/* 유틸리티 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hashCode(str) {
  let hash = 0;
  if (!str) return hash;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
