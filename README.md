# LLM Wiki

Drive + Gemini 기반의 개인 LLM 위키. 백엔드는 Google Apps Script(GAS) 웹앱, 프론트엔드는 GitHub Pages 정적 사이트, 데이터는 Google Drive에 markdown으로 저장됩니다.

## 구조

```
backend/   GAS 프로젝트 (clasp)
docs/      GitHub Pages로 호스팅되는 프론트엔드
```

## 1. Google Cloud 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성(또는 기존 프로젝트 사용).
2. **Gemini API 키** 발급 ([AI Studio](https://aistudio.google.com/app/apikey) 또는 Cloud Console).
3. **OAuth 2.0 클라이언트 ID(웹 애플리케이션)** 생성.
   - 승인된 JavaScript 원본에 GitHub Pages 주소(`https://<user>.github.io`) 및 로컬 테스트용 `http://localhost:8000` 추가.
4. **API 키(Picker용)** 발급 — Drive API 활성화 필요. PDF 업로드 picker에서 사용.

## 2. GAS 백엔드 배포

```bash
npm install -g @google/clasp
clasp login
cd backend
clasp create --type webapp --title "LLM Wiki Backend"
clasp push
```

1. Apps Script 에디터에서 **Project Settings > Script Properties**에 다음 값을 설정:
   - `GEMINI_API_KEY` — Gemini API 키 (기본값, 아래 액션별 키가 없으면 사용)
   - `GEMINI_API_KEY_PARSE`, `GEMINI_API_KEY_INDEX`, `GEMINI_API_KEY_ASK` — (선택) 파싱/색인/검색-답변 사용량을 키별로 구분해서 보고 싶다면 각각 별도의 Gemini API 키를 발급해 설정. 설정하지 않으면 `GEMINI_API_KEY`를 사용.
   - `GEMINI_MODEL` — (선택) 기본값 `gemini-2.5-flash`
   - `OAUTH_CLIENT_ID` — 위에서 만든 OAuth 클라이언트 ID
   - `ALLOWED_EMAILS` — 로그인 허용 이메일(쉼표로 구분, 본인 이메일)
2. `Setup.gs`의 `setup_()` 함수를 한 번 실행 → `LLM-Wiki` 폴더(및 `wiki/`, `raw/`, `index.json`)가 Drive에 생성되고, `ROOT_FOLDER_ID` Script Property가 자동 설정됩니다.
3. **Deploy > New deployment** → 유형: 웹 앱
   - 실행: **나(Me)**
   - 액세스 권한: **모든 사용자(Anyone)**
4. 배포된 웹 앱 URL(`https://script.google.com/macros/s/.../exec`)을 기록합니다.

## 3. 프론트엔드 설정

`docs/config.js`를 열어 다음 값을 채웁니다:

- `GAS_URL` — 2번에서 배포한 웹 앱 URL
- `GOOGLE_CLIENT_ID` — OAuth 클라이언트 ID (백엔드의 `OAUTH_CLIENT_ID`와 동일해야 함)
- `GOOGLE_API_KEY` — Picker용 API 키
- `DRIVE_ROOT_FOLDER_ID` — `setup_()` 실행 후 생성된 `LLM-Wiki` 폴더 ID (백엔드의 `ROOT_FOLDER_ID`와 동일)

## 4. 로컬 테스트

```bash
cd docs
python3 -m http.server 8000
```

`http://localhost:8000` 접속 → Google 로그인 → 페이지 목록/질문/콘텐츠 추가 동작 확인.

## 5. GitHub Pages 배포

저장소 Settings > Pages에서 `main` 브랜치 `/docs` 폴더를 소스로 설정합니다.

## 사용법

- **콘텐츠 추가**: 웹페이지 링크, YouTube 링크, 텍스트/마크다운, 또는 PDF(Drive picker로 업로드)를 입력 → "파싱" → 결과 확인 후 "위키에 추가"(색인).
- **질문하기**: 위키에 색인된 내용을 바탕으로 질문에 대한 답변과 출처를 확인.
- **페이지 탐색**: 좌측 사이드바에서 위키 페이지 목록 확인 및 열람.

## 알려진 제약

- GAS 실행 시간은 6분으로 제한되므로, 한 번에 하나의 소스만 파싱/색인합니다.
- 답변은 스트리밍되지 않고 한 번에 반환됩니다.
- v1에서는 프론트엔드에서 위키 페이지를 직접 편집할 수 없습니다(읽기 + 추가만 가능).
- 큰 PDF(인라인 base64 한계 초과)는 현재 지원되지 않습니다.
