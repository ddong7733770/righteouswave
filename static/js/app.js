/**
 * 바른결 (BarunGyeol) 클라이언트 메인 애플리케이션 스크립트
 * - 매시 정각 카운트다운 타이머 & 자동 갱신
 * - 뉴스 / 유튜브(1,000+) / 커뮤니티(무가입) 3단 그리드 렌더링
 * - 시간대별 급상승 검색어 및 원클릭 키워드 필터링
 * - 비로그인 실시간 O/X 퀵 여론조사 투표 및 인터랙션
 * - 바른 팩트체크 & 원포인트 오피니언 렌더링
 * - 글자 크기 조절 및 다크모드 영속성
 */

let appState = {
  data: null,
  activeKeyword: null,
  countdownInterval: null,
  remainingSeconds: 0,
  lastUpdateHour: "11:00",
  fontSize: localStorage.getItem("bg_font_size") || "normal",
  theme: localStorage.getItem("bg_theme") || "light"
};

// DOM 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  initUserPreferences();
  initEventListeners();
  loadContent();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
});

/* ========================================================
   1. 환경설정 (글자크기 & 다크모드)
   ======================================================== */
function initUserPreferences() {
  // 글자 크기 복원
  setFontSize(appState.fontSize);
  // 테마 복원
  setTheme(appState.theme);
}

function setFontSize(size) {
  document.body.classList.remove("font-normal", "font-large", "font-xlarge");
  document.body.classList.add(`font-${size}`);
  appState.fontSize = size;
  localStorage.setItem("bg_font_size", size);

  document.querySelectorAll(".font-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.size === size);
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
  document.querySelectorAll(".font-btn").forEach(btn => {
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

  // 모바일 모달
  const btnOpenMobile = document.getElementById("btnOpenMobile");
  const mobileModal = document.getElementById("mobileModal");
  const btnCloseMobile = document.getElementById("btnCloseMobile");
  const btnConfirmMobile = document.getElementById("btnConfirmMobile");
  const btnCopyMobileUrl = document.getElementById("btnCopyMobileUrl");

  if (btnOpenMobile && mobileModal) {
    btnOpenMobile.addEventListener("click", () => {
      mobileModal.style.display = "flex";
      loadTunnelUrl();
    });
  }
  const closeMobile = () => { if (mobileModal) mobileModal.style.display = "none"; };
  if (btnCloseMobile) btnCloseMobile.addEventListener("click", closeMobile);
  if (btnConfirmMobile) btnConfirmMobile.addEventListener("click", closeMobile);

  if (btnCopyMobileUrl) {
    btnCopyMobileUrl.addEventListener("click", () => {
      const input = document.getElementById("mobileUrlInput");
      if (input && input.value && input.value.startsWith("http")) {
        navigator.clipboard.writeText(input.value).then(() => {
          alert("휴대폰 접속 링크가 복사되었습니다! 카카오톡 등에 붙여넣기 하세요.");
        }).catch(() => {
          input.select();
          document.execCommand("copy");
          alert("주소가 복사되었습니다!");
        });
      }
    });
  }

  // 주간 리포트 모달
  const btnOpenReport = document.getElementById("btnOpenReport");
  const reportModal = document.getElementById("reportModal");
  const btnCloseReport = document.getElementById("btnCloseReport");
  const btnModalConfirm = document.getElementById("btnModalConfirm");

  if (btnOpenReport && reportModal) {
    btnOpenReport.addEventListener("click", () => {
      reportModal.style.display = "flex";
      renderWeeklyReport();
    });
  }
  const closeReport = () => { if (reportModal) reportModal.style.display = "none"; };
  if (btnCloseReport) btnCloseReport.addEventListener("click", closeReport);
  if (btnModalConfirm) btnModalConfirm.addEventListener("click", closeReport);

  // 영상 모달 닫기
  const videoModal = document.getElementById("videoModal");
  const btnCloseVideo = document.getElementById("btnCloseVideo");
  if (btnCloseVideo && videoModal) {
    btnCloseVideo.addEventListener("click", () => {
      videoModal.style.display = "none";
      const container = document.getElementById("videoContainer");
      if (container) container.innerHTML = "";
    });
  }

  // 검색창 이벤트
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const q = searchInput.value.trim();
      if (q) filterByKeyword(q);
    });
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const q = searchInput.value.trim();
        if (q) filterByKeyword(q);
      }
    });
  }

  // 필터 해제 버튼
  const filterClearBtn = document.getElementById("filterClearBtn");
  if (filterClearBtn) {
    filterClearBtn.addEventListener("click", () => {
      clearFilter();
    });
  }

  // GNB 메뉴 클릭 스크롤 및 탭
  document.querySelectorAll(".gnb-menu .nav-item a").forEach(link => {
    link.addEventListener("click", (e) => {
      document.querySelectorAll(".gnb-menu .nav-item").forEach(item => item.classList.remove("active"));
      link.parentElement.classList.add("active");
    });
  });
}

/* ========================================================
   3. 실시간 시계 & 정각 타이머 엔진
   ======================================================== */
function updateLiveClock() {
  const clockEl = document.getElementById("liveDateTime");
  if (!clockEl) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[now.getDay()];
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  clockEl.textContent = `${year}.${month}.${date} (${day}) ${hours}:${minutes}:${seconds}`;
}

function startCountdown(remainingSec, lastHour) {
  if (appState.countdownInterval) {
    clearInterval(appState.countdownInterval);
  }

  appState.remainingSeconds = remainingSec;
  appState.lastUpdateHour = lastHour;

  const lastHourEl = document.getElementById("lastUpdateHour");
  if (lastHourEl) lastHourEl.textContent = lastHour;

  const timerEl = document.getElementById("countdownTimer");

  function tick() {
    if (appState.remainingSeconds <= 0) {
      if (timerEl) timerEl.textContent = "00:00:00 (정각 갱신 중)";
      clearInterval(appState.countdownInterval);
      setTimeout(() => {
        forceRefresh();
      }, 1500);
      return;
    }

    const hrs = Math.floor(appState.remainingSeconds / 3600);
    const mins = Math.floor((appState.remainingSeconds % 3600) / 60);
    const secs = appState.remainingSeconds % 60;

    const timeStr = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    if (timerEl) timerEl.textContent = timeStr;

    appState.remainingSeconds--;
  }

  tick();
  appState.countdownInterval = setInterval(tick, 1000);
}

/* ========================================================
   4. 데이터 수집 및 로드 (하이브리드: 백엔드 API + GitHub Pages 정적 지원)
   ======================================================== */
// 클라이언트 정각 시간 계산기 (GitHub Pages 환경용)
function getClientStatus() {
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, "0") + ":00";
  const nextHourDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
  const remainingSec = Math.max(0, Math.floor((nextHourDate - now) / 1000));
  const nextHour = String(nextHourDate.getHours()).padStart(2, "0") + ":00";

  return {
    last_update: currentHour,
    next_update: nextHour,
    remaining_seconds: remainingSec
  };
}

// 클라이언트 키워드 필터링 헬퍼
function filterClientData(raw, keyword) {
  if (!keyword) return raw;
  const kw = keyword.trim();
  const subKws = kw.split(" ").filter(k => k.length >= 2);
  const searchKws = subKws.length > 0 ? subKws : [kw];

  const data = JSON.parse(JSON.stringify(raw));
  const allNews = [data.news.headline].concat(data.news.list || []);

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
    data.news = {
      headline: filteredNews[0],
      list: filteredNews.slice(1)
    };
  } else {
    data.news = {
      headline: raw.news.headline,
      list: []
    };
  }
  data.youtube = filteredYt;
  data.community = filteredComm;

  return data;
}

let cachedStaticData = null;

async function loadContent(keyword = null) {
  let data = null;

  // 1. 백엔드 API 호출 시도 (로컬 서버 환경)
  try {
    let url = "/api/content";
    if (keyword) {
      url += `?keyword=${encodeURIComponent(keyword)}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    // API 연결 불가 -> GitHub Pages 정적 모드로 자동 전환
  }

  // 2. 백엔드가 없는 경우 (GitHub Pages 정적 호스팅 환경)
  if (!data) {
    try {
      if (!cachedStaticData) {
        const res = await fetch("data/content.json");
        if (res.ok) {
          cachedStaticData = await res.json();
        }
      }

      if (cachedStaticData) {
        const cloned = JSON.parse(JSON.stringify(cachedStaticData));
        cloned.status = getClientStatus();

        // 투표수 로컬스토리지 동기화
        const localAgree = parseInt(localStorage.getItem("bg_poll_agree_extra") || "0", 10);
        const localDisagree = parseInt(localStorage.getItem("bg_poll_disagree_extra") || "0", 10);
        if (cloned.poll) {
          cloned.poll.agree_count += localAgree;
          cloned.poll.disagree_count += localDisagree;
          cloned.poll.total_count = cloned.poll.agree_count + cloned.poll.disagree_count;
          if (cloned.poll.total_count > 0) {
            cloned.poll.agree_ratio = Math.round((cloned.poll.agree_count / cloned.poll.total_count) * 1000) / 10;
            cloned.poll.disagree_ratio = Math.round((100 - cloned.poll.agree_ratio) * 10) / 10;
          }
        }

        data = filterClientData(cloned, keyword);
      }
    } catch (staticErr) {
      console.error("정적 데이터 로드 오류:", staticErr);
    }
  }

  if (!data) {
    console.error("데이터를 불러올 수 없습니다.");
    return;
  }

  appState.data = data;

  // 타이머 기동
  if (data.status) {
    startCountdown(data.status.remaining_seconds, data.status.last_update);
  }

  // 각 카테고리별 렌더링
  renderHeadlineNews(data.news.headline);
  renderStraightNews(data.news.list);
  renderYouTube(data.youtube);
  renderCommunity(data.community);
  renderTrendingKeywords(data.trending_keywords);
  renderFactCheck(data.fact_check);
  renderOpinion(data.opinion);
  renderPoll(data.poll);

  // 필터링 상태 반영
  updateFilterUI(keyword, data.filtered_counts);
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
    } catch (e) {
      // GitHub Pages 환경
    }

    if (!freshData && cachedStaticData) {
      // GitHub Pages 환경: 클라이언트 시간 갱신 및 재렌더링
      await new Promise(r => setTimeout(r, 600));
      cachedStaticData.status = getClientStatus();
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
      clearFilter();
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
   5. 카테고리별 렌더링 함수
   ======================================================== */

// (1) 메인 헤드라인 뉴스 (실제 기사 및 언론사 매칭, 무관한 이미지 배제)
function renderHeadlineNews(headline) {
  if (!headline) return;

  const thumbWrap = document.querySelector(".headline-thumb-wrap");
  const imgEl = document.getElementById("headlineImg");
  const mediaEl = document.getElementById("headlineMedia");
  const timeEl = document.getElementById("headlineTime");
  const titleEl = document.getElementById("headlineTitle");
  const summaryEl = document.getElementById("headlineSummary");
  const linkEl = document.getElementById("headlineLink");

  // 기사와 무관한 임의의 사진(Unsplash 등) 노출 금지
  if (imgEl && thumbWrap) {
    if (headline.thumbnail && headline.thumbnail.startsWith("http")) {
      imgEl.src = headline.thumbnail;
      imgEl.alt = headline.title;
      thumbWrap.style.display = "block";
    } else {
      // 실제 기사 이미지가 없는 경우 관련 없는 이미지를 띄우지 않고 텍스트 중심 헤드라인 카드로 깔끔하게 표시
      thumbWrap.style.display = "none";
    }
  }

  if (mediaEl) mediaEl.textContent = headline.media || "주요언론";
  if (timeEl) timeEl.textContent = headline.time || "실시간";
  if (titleEl) {
    titleEl.innerHTML = `<a href="${headline.link}" target="_blank" rel="noopener noreferrer">${escapeHtml(headline.title)}</a>`;
  }
  if (summaryEl) summaryEl.textContent = headline.summary || "";
  if (linkEl) linkEl.href = headline.link;
}

// (2) 스트레이트 뉴스 리스트 (텍스트 위주)
function renderStraightNews(newsList) {
  const container = document.getElementById("straightNewsList");
  if (!container) return;

  if (!newsList || newsList.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 뉴스가 없습니다.</div>';
    return;
  }

  const html = newsList.map(item => `
    <article class="news-item">
      <div class="news-header-meta">
        <span class="news-media-tag">${escapeHtml(item.media || "주요언론")}</span>
        <span>${escapeHtml(item.time || "실시간")}</span>
      </div>
      <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-link">
        ${escapeHtml(item.title)}
      </a>
    </article>
  `).join("");

  container.innerHTML = html;
}

// (3) 실시간 유튜브 트렌드 (1,000+ 하이라이트)
function renderYouTube(ytList) {
  const container = document.getElementById("youtubeGrid");
  if (!container) return;

  if (!ytList || ytList.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 유튜브 영상이 없습니다.</div>';
    return;
  }

  const html = ytList.map(item => `
    <div class="yt-card" onclick="openYouTube('${item.youtube_url}', '${escapeHtml(item.title)}')">
      <div class="yt-thumb-box">
        <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy">
        <div class="yt-play-overlay">
          <div class="play-circle">▶</div>
        </div>
        <span class="yt-duration-badge">${item.duration || "영상"}</span>
      </div>
      <div class="yt-content-box">
        <h4 class="yt-title">${escapeHtml(item.title)}</h4>
        <div class="yt-channel-row">
          <span class="yt-channel-name">📺 ${escapeHtml(item.channel)}</span>
          <span>${item.upload_time}</span>
        </div>
        <div class="yt-views-badge-row">
          <span class="yt-views-badge">조회수 ${item.views}회</span>
          <span class="yt-topic-badge">#${escapeHtml(item.keyword || "트렌드")}</span>
        </div>
      </div>
    </div>
  `).join("");

  container.innerHTML = html;
}

function openYouTube(url, title) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// (4) 무가입 오픈 커뮤니티 실시간 베스트
function renderCommunity(commList) {
  const container = document.getElementById("communityList");
  if (!container) return;

  if (!commList || commList.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 조건의 커뮤니티 글이 없습니다.</div>';
    return;
  }

  const html = commList.map(item => `
    <article class="comm-item">
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
      <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="comm-title">
        ${escapeHtml(item.title)}
      </a>
      <div class="comm-footer-meta">
        <span class="comm-badge-label">${item.badge || "실시간"}</span>
        <span>${item.time}</span>
      </div>
    </article>
  `).join("");

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

// (6) 바른 팩트체크 코너 (3단 구조: 주장 - 팩트 - 근거)
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
      
      <!-- 1단: 주장 -->
      <div class="fact-block block-claim">
        <strong>❌ 논란의 주장:</strong><br>
        ${escapeHtml(item.claim)}
      </div>

      <!-- 2단: 팩트 -->
      <div class="fact-block block-fact">
        <strong>✅ 검증된 팩트:</strong><br>
        ${escapeHtml(item.fact)}
      </div>

      <!-- 3단: 근거 데이터 -->
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

// (7) 원포인트 오피니언 (아침/저녁 엄선 사설/칼럼)
function renderOpinion(opinions) {
  const container = document.getElementById("opinionGrid");
  if (!container || !opinions) return;

  const html = opinions.map(item => `
    <div class="op-card">
      <div class="op-meta-row">
        <span class="op-category">${escapeHtml(item.category)}</span>
        <span>${item.time}</span>
      </div>
      <div class="op-author">${escapeHtml(item.author)} · ${escapeHtml(item.media)}</div>
      <h3 class="op-title">${escapeHtml(item.title)}</h3>
      <p class="op-summary">${escapeHtml(item.summary)}</p>
      <div class="op-footer">
        <span>읽는 시간: ${item.read_time}</span>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="op-link-btn">
          사설 원문 읽기 ↗
        </a>
      </div>
    </div>
  `).join("");

  container.innerHTML = html;
}

// (8) 실시간 퀵 여론조사 (O/X 투표)
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

  // 투표 참여 여부 확인
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
    alert("이미 참여하신 여론조사입니다. (1인 1투표 원칙)");
    return;
  }

  let success = false;
  // 1. 서버 API 시도
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
        alert("투표가 정상적으로 반영되었습니다. 감사합니다!");
        success = true;
      }
    }
  } catch (err) {
    // API 연결 불가 -> GitHub Pages 모드
  }

  // 2. 서버가 없는 경우 (GitHub Pages 정적 모드)
  if (!success) {
    localStorage.setItem("bg_voted_poll", type);
    if (type === "agree") {
      const current = parseInt(localStorage.getItem("bg_poll_agree_extra") || "0", 10);
      localStorage.setItem("bg_poll_agree_extra", current + 1);
    } else {
      const current = parseInt(localStorage.getItem("bg_poll_disagree_extra") || "0", 10);
      localStorage.setItem("bg_poll_disagree_extra", current + 1);
    }
    if (appState.data && appState.data.poll) {
      if (type === "agree") appState.data.poll.agree_count += 1;
      else appState.data.poll.disagree_count += 1;
      appState.data.poll.total_count = appState.data.poll.agree_count + appState.data.poll.disagree_count;
      appState.data.poll.agree_ratio = Math.round((appState.data.poll.agree_count / appState.data.poll.total_count) * 1000) / 10;
      appState.data.poll.disagree_ratio = Math.round((100 - appState.data.poll.agree_ratio) * 10) / 10;
      renderPoll(appState.data.poll);
    }
    alert("투표가 정상적으로 반영되었습니다. (1인 1투표 원칙 준수)");
  }
}

// (9) 주간 키워드 데이터 리포트
function renderWeeklyReport() {
  if (!appState.data || !appState.data.weekly_report) return;
  const report = appState.data.weekly_report;

  const periodEl = document.getElementById("reportPeriod");
  const totalEl = document.getElementById("reportTotalCurated");
  const tableBody = document.getElementById("reportKeywordTable");
  const insightsList = document.getElementById("reportInsightsList");

  if (periodEl) periodEl.textContent = report.period;
  if (totalEl) totalEl.textContent = report.total_curated;

  if (tableBody) {
    tableBody.innerHTML = report.top_keywords.map(k => `
      <tr>
        <td><strong>${k.rank}위</strong></td>
        <td><strong style="color: var(--primary);">${escapeHtml(k.keyword)}</strong></td>
        <td>${k.clicks}</td>
        <td><span style="color: var(--accent-red); font-weight: 700;">${k.ratio}</span></td>
      </tr>
    `).join("");
  }

  if (insightsList) {
    insightsList.innerHTML = report.highlights.map(h => `
      <li>${escapeHtml(h)}</li>
    `).join("");
  }
}

/* ========================================================
   6. 키워드 필터링 및 리셋
   ======================================================== */
function filterByKeyword(keyword) {
  if (!keyword) return;
  appState.activeKeyword = keyword;
  loadContent(keyword);

  // 검색창에도 표시
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = keyword;

  // 상단 부드러운 스크롤 이동
  window.scrollTo({ top: 120, behavior: "smooth" });
}

function clearFilter() {
  appState.activeKeyword = null;
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  loadContent();
}

function resetFilter(e) {
  e.preventDefault();
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
      countText.textContent = `관련 뉴스 ${counts.news}건, 유튜브 ${counts.youtube}건, 커뮤니티 ${counts.community}건 정렬됨`;
    }
  } else {
    bar.style.display = "none";
  }
}

/* 유틸리티: HTML 이스케이프 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* 터널 URL 및 QR코드 로드 */
async function loadTunnelUrl() {
  const urlInput = document.getElementById("mobileUrlInput");
  const qrImg = document.getElementById("mobileQrImg");

  // GitHub Pages 등 웹 호스팅 환경인 경우 현재 URL을 바로 사용
  if (window.location.hostname.includes("github.io") || window.location.hostname.includes("vercel.app") || window.location.hostname.includes("onrender.com")) {
    const liveUrl = window.location.href;
    if (urlInput) urlInput.value = liveUrl;
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(liveUrl)}`;
    }
    return;
  }

  // 로컬 서버 환경
  try {
    const res = await fetch("/api/tunnel-url");
    if (res.ok) {
      const data = await res.json();
      if (data.tunnel_url) {
        if (urlInput) urlInput.value = data.tunnel_url;
        if (qrImg) {
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.tunnel_url)}`;
        }
        return;
      }
    }
  } catch (err) {
    // pass
  }

  const fallback = window.location.href.startsWith("http") ? window.location.href : "http://localhost:8080";
  if (urlInput) urlInput.value = fallback;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(fallback)}`;
  }
}

