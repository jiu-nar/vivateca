// Main app logic: page list, page viewer, parse/index, and ask.

(function () {
  const els = {
    pageList: document.getElementById('page-list'),
    pageTitle: document.getElementById('page-title'),
    pageContent: document.getElementById('page-content'),
    main: document.getElementById('main'),
    signedOut: document.getElementById('signed-out'),
    signedIn: document.getElementById('signed-in'),

    parseType: document.getElementById('parse-type'),
    parseInput: document.getElementById('parse-input'),
    parsePdfRow: document.getElementById('parse-pdf-row'),
    pickPdfBtn: document.getElementById('pick-pdf-btn'),
    pickPdfStatus: document.getElementById('pick-pdf-status'),
    parseBtn: document.getElementById('parse-btn'),
    parseStatus: document.getElementById('parse-status'),
    parseResult: document.getElementById('parse-result'),
    indexBtn: document.getElementById('index-btn'),

    askInput: document.getElementById('ask-input'),
    askBtn: document.getElementById('ask-btn'),
    askStatus: document.getElementById('ask-status'),
    askAnswer: document.getElementById('ask-answer'),
    askSources: document.getElementById('ask-sources')
  };

  let pendingRawId = null;
  let pickedPdfFileId = null;

  function onSignIn() {
    els.signedOut.style.display = 'none';
    els.signedIn.style.display = 'block';
    refreshPageList();
  }

  async function refreshPageList() {
    els.pageList.innerHTML = '<li class="muted">로딩 중...</li>';
    try {
      const data = await LLMWikiApi.listPages();
      renderPageList(data.pages || []);
    } catch (err) {
      els.pageList.innerHTML = '<li class="error">' + escapeHtml(err.message) + '</li>';
    }
  }

  function renderPageList(pages) {
    if (pages.length === 0) {
      els.pageList.innerHTML = '<li class="muted">아직 페이지가 없습니다.</li>';
      return;
    }
    els.pageList.innerHTML = '';
    pages
      .sort(function (a, b) { return a.title.localeCompare(b.title); })
      .forEach(function (page) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = page.title;
        a.title = page.summary || '';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openPage(page);
        });
        li.appendChild(a);
        els.pageList.appendChild(li);
      });
  }

  async function openPage(page) {
    els.pageTitle.textContent = page.title;
    els.pageContent.innerHTML = '로딩 중...';
    try {
      const data = await LLMWikiApi.getPage(page.id);
      els.pageContent.innerHTML = marked.parse(data.content);
    } catch (err) {
      els.pageContent.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
    }
  }

  // --- Parse / Index ---

  els.parseType.addEventListener('change', function () {
    const type = els.parseType.value;
    els.parsePdfRow.style.display = type === 'pdf' ? 'flex' : 'none';
    els.parseInput.style.display = type === 'pdf' ? 'none' : 'block';
    els.parseInput.placeholder =
      type === 'url' ? '웹페이지 URL을 입력하세요' :
      type === 'youtube' ? 'YouTube 영상 URL을 입력하세요' :
      '텍스트 또는 마크다운 내용을 입력하세요';
  });

  els.pickPdfBtn.addEventListener('click', openPdfPicker);

  els.parseBtn.addEventListener('click', async function () {
    const type = els.parseType.value;
    const payload = { type: type };

    if (type === 'pdf') {
      if (!pickedPdfFileId) {
        setStatus(els.parseStatus, 'PDF 파일을 먼저 선택하세요.', true);
        return;
      }
      payload.fileId = pickedPdfFileId;
    } else {
      const value = els.parseInput.value.trim();
      if (!value) {
        setStatus(els.parseStatus, '내용을 입력하세요.', true);
        return;
      }
      payload.payload = value;
    }

    setStatus(els.parseStatus, '파싱 중... (최대 몇 분 소요)');
    els.parseResult.style.display = 'none';
    els.indexBtn.disabled = true;
    pendingRawId = null;

    try {
      const result = await LLMWikiApi.parse(payload);
      pendingRawId = result.rawId;
      els.parseResult.style.display = 'block';
      els.parseResult.querySelector('.preview-title').textContent = result.title;
      els.parseResult.querySelector('.preview-body').textContent = result.preview;
      els.indexBtn.disabled = false;
      setStatus(els.parseStatus, '파싱 완료. 아래 내용을 확인하고 위키에 추가하세요.');
    } catch (err) {
      setStatus(els.parseStatus, '오류: ' + err.message, true);
    }
  });

  els.indexBtn.addEventListener('click', async function () {
    if (!pendingRawId) return;
    els.indexBtn.disabled = true;
    setStatus(els.parseStatus, '색인 중... (최대 몇 분 소요)');

    try {
      const result = await LLMWikiApi.index({ rawId: pendingRawId });
      const summary = result.pages.map(function (p) {
        return p.title + ' (' + (p.action === 'create' ? '신규' : '갱신') + ')';
      }).join(', ');
      setStatus(els.parseStatus, '완료: ' + summary);
      els.parseResult.style.display = 'none';
      els.parseInput.value = '';
      pendingRawId = null;
      pickedPdfFileId = null;
      els.pickPdfStatus.textContent = '';
      refreshPageList();
    } catch (err) {
      setStatus(els.parseStatus, '오류: ' + err.message, true);
      els.indexBtn.disabled = false;
    }
  });

  // --- Ask ---

  els.askBtn.addEventListener('click', async function () {
    const question = els.askInput.value.trim();
    if (!question) return;

    setStatus(els.askStatus, '답변 생성 중... (최대 몇 분 소요)');
    els.askAnswer.textContent = '';
    els.askSources.innerHTML = '';

    try {
      const result = await LLMWikiApi.ask({ question: question });
      els.askAnswer.innerHTML = marked.parse(result.answer);
      result.sources.forEach(function (src) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = src.title;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          const page = (window.__llmWikiIndexCache || []).find(function (p) { return p.path === src.path; });
          if (page) openPage(page);
        });
        li.appendChild(a);
        els.askSources.appendChild(li);
      });
      setStatus(els.askStatus, '');
    } catch (err) {
      setStatus(els.askStatus, '오류: ' + err.message, true);
    }
  });

  // --- Google Picker (PDF upload to Drive) ---

  function openPdfPicker() {
    gapi.load('picker', function () {
      LLMWikiAuth.getAccessToken().then(function (accessToken) {
        const uploadView = new google.picker.DocsUploadView()
          .setParent(window.LLM_WIKI_CONFIG.DRIVE_ROOT_FOLDER_ID);

        const picker = new google.picker.PickerBuilder()
          .addView(uploadView)
          .addView(new google.picker.DocsView(google.picker.ViewId.PDFS).setParent(window.LLM_WIKI_CONFIG.DRIVE_ROOT_FOLDER_ID))
          .setOAuthToken(accessToken)
          .setDeveloperKey(window.LLM_WIKI_CONFIG.GOOGLE_API_KEY)
          .setCallback(function (data) {
            if (data.action === google.picker.Action.PICKED) {
              const doc = data.docs[0];
              pickedPdfFileId = doc.id;
              els.pickPdfStatus.textContent = '선택됨: ' + doc.name;
            }
          })
          .build();
        picker.setVisible(true);
      }).catch(function (err) {
        els.pickPdfStatus.textContent = '인증 오류: ' + (err.error || err.message || err);
      });
    });
  }

  // --- Helpers ---

  function setStatus(el, text, isError) {
    el.textContent = text;
    el.className = 'status' + (isError ? ' error' : '');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Keep a cache of page list for source link navigation in ask results.
  const originalRender = renderPageList;
  renderPageList = function (pages) {
    window.__llmWikiIndexCache = pages;
    originalRender(pages);
  };

  LLMWikiAuth.init(onSignIn);
})();
