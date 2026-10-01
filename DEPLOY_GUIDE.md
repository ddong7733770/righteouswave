# 📱 바른결 (BarunGyeol) 모바일 및 외부 배포 완벽 가이드

> **"내 컴퓨터뿐만 아니라, 내 스마트폰(LTE/5G), 태블릿, 외부 어디서든 링크 하나로 '바른결'을 열어보실 수 있습니다!"**

---

## ⚡ 방법 1: 즉시 휴대폰으로 보기 (설정 불필요, 1초 접속)

컴퓨터에서 **`run_bareungyeol.bat`**을 실행하시면, 자동으로 **보안 터널(Cloudflare Tunnel)**이 생성되어 전 세계 어디서든 스마트폰으로 접속할 수 있는 전용 HTTPS 주소가 만들어집니다!

### 📱 스마트폰 접속 주소:
```
https://ping-substance-tennis-johnny.trycloudflare.com
```
*(서버를 다시 실행하실 때마다 새로운 고유 주소가 생성되어 콘솔 화면 및 PC 화면에 표시됩니다)*

### 🔍 휴대폰으로 접속하는 3가지 방법:
1. **QR 코드 스캔 (가장 추천)**:
   - PC 화면 상단 헤더의 **`📱 휴대폰 연결`** 버튼을 클릭합니다.
   - 나타나는 **QR 코드**를 스마트폰 기본 카메라로 비추면 바로 웹사이트가 열립니다!
2. **카카오톡 '나와의 채팅'에 링크 보내기**:
   - PC 화면에서 **`주소 복사`** 버튼을 누른 뒤, 카카오톡 나와의 채팅에 붙여넣기(`Ctrl+V`)하여 휴대폰에서 클릭합니다.
3. **휴대폰 브라우저에 직접 입력**:
   - 스마트폰 사파리(아이폰) 또는 크롬/삼성인터넷(갤럭시) 주소창에 위 주소를 입력하여 접속합니다.

> 💡 **참고:** 이 방법은 컴퓨터가 켜져 있고 콘솔 창이 열려 있는 동안 유지됩니다.

---

## ☁️ 방법 2: 컴퓨터를 꺼도 24시간 유지되는 무료 클라우드 영구 배포

컴퓨터를 꺼두어도 스마트폰에서 24시간 언제나 접속하고 싶으신 경우, 글로벌 무료 호스팅 서비스인 **Render.com**을 통해 5분 만에 무료로 배포할 수 있습니다.

### 준비 단계: GitHub에 코드 올리기
1. [GitHub](https://github.com)에 로그인 후 새 Repository(`bareungyeol`)를 만듭니다.
2. 현재 `bareungyeol` 폴더의 파일들을 GitHub에 푸시합니다.

### Render.com 1분 무료 배포:
1. [Render.com](https://render.com)에 무료 회원가입 후 로그인합니다.
2. **`New +`** 버튼 클릭 -> **`Web Service`** 선택
3. 위에서 올린 GitHub 저장소(`bareungyeol`)를 선택합니다.
4. 아래 설정값 입력:
   - **Name**: `bareungyeol` (또는 원하는 이름)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` (평생 무료)
5. **`Create Web Service`** 버튼을 누르면 2분 후 `https://bareungyeol.onrender.com` 과 같은 **나만의 24시간 고유 주소**가 생성됩니다!
6. 이제 이 주소를 스마트폰 홈 화면에 바로가기(앱처럼 추가)해 두시면 언제 어디서나 바로 보실 수 있습니다.
