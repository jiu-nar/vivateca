(function () {
  const $ = id => document.getElementById(id);

  const els = {
    pageList:       $('page-list'),
    pageSearch:     $('page-search'),
    pageTitle:      $('page-title'),
    pageContent:    $('page-content'),
    signedOut:      $('signed-out'),
    signedIn:       $('signed-in'),
    signoutBtn:     $('signout-btn'),

    tabAskBtn:      $('tab-ask-btn'),
    tabAddBtn:      $('tab-add-btn'),
    drawerAsk:      $('drawer-ask'),
    drawerAdd:      $('drawer-add'),

    askInput:       $('ask-input'),
    askBtn:         $('ask-btn'),
    askStatus:      $('ask-status'),
    askAnswer:      $('ask-answer'),
    askSources:     $('ask-sources'),
    askSourcesWrap: $('ask-sources-wrap'),

    parsePdfRow:    $('parse-pdf-row'),
    pickPdfBtn:     $('pick-pdf-btn'),
    pickPdfStatus:  $('pick-pdf-status'),
    parseInput:     $('parse-input'),
    parseBtn:       $('parse-btn'),
    parseStatus:    $('parse-status'),
    parseResult:    $('parse-result'),
    indexBtn:       $('index-btn')
  };

  let allPages = [];
  let pendingRawId = null;
  let pickedPdfFileId = null;
  let currentType = 'url';
  let activePageEl = null;

  // filter state
  const filter = { q: '', type: '', tag: '' };
  const PAGE_SIZE = 15;
  let currentPage = 0;

  // ── Auth ──
  function onSignIn() {
    els.signedOut.style.display = 'none';
    els.signedIn.style.display = 'block';
    refreshPageList();
  }

  els.signoutBtn.addEventListener('click', () => LLMWikiAuth.signOut());

  // ── Drawers ──
  function openDrawer(which) {
    const askActive = which === 'ask';
    els.drawerAsk.style.display = askActive ? 'block' : 'none';
    els.drawerAdd.style.display = askActive ? 'none' : 'block';
    els.tabAskBtn.classList.toggle('active', askActive);
    els.tabAddBtn.classList.toggle('active', !askActive);
  }

  function closeDrawers() {
    els.drawerAsk.style.display = 'none';
    els.drawerAdd.style.display = 'none';
    els.tabAskBtn.classList.remove('active');
    els.tabAddBtn.classList.remove('active');
  }

  els.tabAskBtn.addEventListener('click', () => {
    els.drawerAsk.style.display === 'none' ? openDrawer('ask') : closeDrawers();
  });
  els.tabAddBtn.addEventListener('click', () => {
    els.drawerAdd.style.display === 'none' ? openDrawer('add') : closeDrawers();
  });

  document.querySelectorAll('.close-drawer').forEach(btn => {
    btn.addEventListener('click', closeDrawers);
  });

  // ── Page List ──
  async function refreshPageList() {
    els.pageList.innerHTML = '<li><span class="empty-msg">로딩 중…</span></li>';
    try {
      const data = await LLMWikiApi.listPages();
      allPages = data.pages || [];
      buildTagFilter();
      renderFiltered();
    } catch (err) {
      els.pageList.innerHTML = '<li><span class="error-msg">' + escHtml(err.message) + '</span></li>';
    }
  }

  function renderPageList(pages) {
    if (!pages.length) {
      els.pageList.innerHTML = '<li><span class="empty-msg">아직 페이지가 없습니다.</span></li>';
      return;
    }
    els.pageList.innerHTML = '';
    [...pages]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach(page => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.title = page.summary || '';
        const typeEmoji = typeToEmoji(page.type);
        a.innerHTML = typeEmoji + ' ' + escHtml(page.title) +
          (page.type ? '<span class="page-type-badge">' + escHtml(page.type) + '</span>' : '');
        a.addEventListener('click', e => { e.preventDefault(); openPage(page, a); });
        li.appendChild(a);
        els.pageList.appendChild(li);
      });
  }

  // ── Filtering & Pagination ──
  function applyFilters() {
    currentPage = 0;
    renderFiltered();
  }

  function renderFiltered() {
    const q = filter.q.toLowerCase();
    const filtered = allPages.filter(p => {
      if (filter.type && p.type !== filter.type) return false;
      if (filter.tag && !(p.tags || []).includes(filter.tag)) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.tags || []).some(t => t.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => a.title.localeCompare(b.title));

    const total = filtered.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    currentPage = Math.min(currentPage, totalPages - 1);
    const slice = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    renderPageList(slice);
    renderPagination(currentPage, totalPages, total);
  }

  function renderPagination(page, totalPages, total) {
    const el = $('pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<button class="pg-btn" ' + (page === 0 ? 'disabled' : '') + ' id="pg-prev">‹</button>' +
      '<span class="pg-info">' + (page + 1) + ' / ' + totalPages + '</span>' +
      '<button class="pg-btn" ' + (page >= totalPages - 1 ? 'disabled' : '') + ' id="pg-next">›</button>';
    $('pg-prev').addEventListener('click', () => { currentPage--; renderFiltered(); });
    $('pg-next').addEventListener('click', () => { currentPage++; renderFiltered(); });
  }

  function buildTagFilter() {
    const tagCount = {};
    allPages.forEach(p => (p.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const tags = Object.keys(tagCount).sort();
    const el = $('tag-filter');
    if (!tags.length) { el.innerHTML = ''; return; }
    el.innerHTML = tags.map(t =>
      '<button class="tag-chip' + (filter.tag === t ? ' active' : '') + '" data-tag="' + escHtml(t) + '">' + escHtml(t) + '</button>'
    ).join('');
    el.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', function () {
        filter.tag = filter.tag === this.dataset.tag ? '' : this.dataset.tag;
        el.querySelectorAll('.tag-chip').forEach(b => b.classList.toggle('active', b.dataset.tag === filter.tag));
        applyFilters();
      });
    });
  }

  // Type filter
  $('type-filter').querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      $('type-filter').querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filter.type = this.dataset.type;
      applyFilters();
    });
  });

  // ── Search ──
  els.pageSearch.addEventListener('input', function () {
    filter.q = this.value.trim();
    applyFilters();
  });

  // ── Page View ──
  async function openPage(page, linkEl) {
    if (activePageEl) activePageEl.classList.remove('active');
    activePageEl = linkEl;
    if (linkEl) linkEl.classList.add('active');

    els.pageTitle.textContent = page.title;
    els.pageContent.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">로딩 중…</p>';

    try {
      const data = await LLMWikiApi.getPage(page.id);
      const content = stripFrontmatter(data.content);
      let html = '';
      if (page.type) {
        html += '<span class="fm-badge">' + escHtml(page.type) + '</span>';
      }
      html += marked.parse(content);
      els.pageContent.innerHTML = html;
    } catch (err) {
      els.pageContent.innerHTML = '<p style="color:var(--danger)">' + escHtml(err.message) + '</p>';
    }
  }

  function stripFrontmatter(text) {
    if (!text.startsWith('---')) return text;
    const end = text.indexOf('\n---', 3);
    return end !== -1 ? text.slice(end + 4).trimStart() : text;
  }

  // ── Type Tabs ──
  document.querySelectorAll('.type-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentType = this.dataset.type;

      const isPdf = currentType === 'pdf';
      els.parsePdfRow.style.display = isPdf ? 'flex' : 'none';
      els.parseInput.style.display = isPdf ? 'none' : 'block';
      els.parseInput.placeholder =
        currentType === 'url'     ? '웹페이지 URL을 입력하세요…' :
        currentType === 'youtube' ? 'YouTube 링크를 입력하세요…' :
                                    '텍스트 또는 마크다운을 입력하세요…';
    });
  });

  // ── Parse ──
  els.parseBtn.addEventListener('click', async () => {
    const payload = { type: currentType };

    if (currentType === 'pdf') {
      if (!pickedPdfFileId) { setStatus(els.parseStatus, 'PDF 파일을 먼저 선택하세요.', 'error'); return; }
      payload.fileId = pickedPdfFileId;
    } else {
      const val = els.parseInput.value.trim();
      if (!val) { setStatus(els.parseStatus, '내용을 입력하세요.', 'error'); return; }
      payload.payload = val;
    }

    setStatus(els.parseStatus, '파싱 중… (잠시 기다려 주세요)');
    els.parseResult.style.display = 'none';
    els.indexBtn.disabled = true;
    pendingRawId = null;

    try {
      const result = await LLMWikiApi.parse(payload);
      pendingRawId = result.rawId;
      els.parseResult.style.display = 'block';
      els.parseResult.querySelector('.preview-title-text').textContent = result.title;
      els.parseResult.querySelector('.preview-body').textContent = result.preview;
      els.indexBtn.disabled = false;
      setStatus(els.parseStatus, '파싱 완료. 내용을 확인하고 위키에 추가하세요.', 'success');
    } catch (err) {
      setStatus(els.parseStatus, '오류: ' + err.message, 'error');
    }
  });

  // ── Index ──
  els.indexBtn.addEventListener('click', async () => {
    if (!pendingRawId) return;
    els.indexBtn.disabled = true;
    setStatus(els.parseStatus, '위키에 추가 중…');

    try {
      const result = await LLMWikiApi.index({ rawId: pendingRawId });
      const summary = result.pages.map(p =>
        p.title + (p.action === 'create' ? ' 신규' : ' 갱신')
      ).join(', ');
      setStatus(els.parseStatus, '완료: ' + summary, 'success');
      els.parseResult.style.display = 'none';
      els.parseInput.value = '';
      pendingRawId = null;
      pickedPdfFileId = null;
      els.pickPdfStatus.textContent = '';
      filter.type = ''; filter.tag = ''; filter.q = '';
      $('type-filter').querySelectorAll('.tf-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
      els.pageSearch.value = '';
      refreshPageList();
    } catch (err) {
      setStatus(els.parseStatus, '오류: ' + err.message, 'error');
      els.indexBtn.disabled = false;
    }
  });

  // ── Ask ──
  els.askBtn.addEventListener('click', async () => {
    const question = els.askInput.value.trim();
    if (!question) return;

    setStatus(els.askStatus, '답변 생성 중…');
    els.askAnswer.innerHTML = '';
    els.askSourcesWrap.style.display = 'none';

    try {
      const result = await LLMWikiApi.ask({ question });
      els.askAnswer.innerHTML = marked.parse(result.answer);
      if (result.sources && result.sources.length) {
        els.askSources.innerHTML = '';
        result.sources.forEach(src => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = src.title;
          a.addEventListener('click', e => {
            e.preventDefault();
            const page = allPages.find(p => p.path === src.path);
            if (page) openPage(page, null);
          });
          li.appendChild(a);
          els.askSources.appendChild(li);
        });
        els.askSourcesWrap.style.display = 'block';
      }
      setStatus(els.askStatus, '');
    } catch (err) {
      setStatus(els.askStatus, '오류: ' + err.message, 'error');
    }
  });

  els.askInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) els.askBtn.click();
  });

  // ── PDF Picker ──
  els.pickPdfBtn.addEventListener('click', openPdfPicker);

  function openPdfPicker() {
    gapi.load('picker', () => {
      LLMWikiAuth.getAccessToken().then(token => {
        const picker = new google.picker.PickerBuilder()
          .addView(new google.picker.DocsUploadView().setParent(LLM_WIKI_CONFIG.DRIVE_ROOT_FOLDER_ID))
          .addView(new google.picker.DocsView(google.picker.ViewId.PDFS).setParent(LLM_WIKI_CONFIG.DRIVE_ROOT_FOLDER_ID))
          .setOAuthToken(token)
          .setDeveloperKey(LLM_WIKI_CONFIG.GOOGLE_API_KEY)
          .setCallback(data => {
            if (data.action === google.picker.Action.PICKED) {
              pickedPdfFileId = data.docs[0].id;
              els.pickPdfStatus.textContent = '선택됨: ' + data.docs[0].name;
            }
          })
          .build();
        picker.setVisible(true);
      }).catch(err => {
        els.pickPdfStatus.textContent = '인증 오류: ' + (err.error || err.message || err);
      });
    });
  }

  // ── Helpers ──
  function setStatus(el, text, type) {
    el.textContent = text;
    el.className = 'status-msg' + (type ? ' ' + type : '');
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function typeToEmoji(type) {
    return { Concept: '💡', Summary: '📝', 'How-to': '🔧', Reference: '📌', Note: '🗒️' }[type] || '📄';
  }

  LLMWikiAuth.init(onSignIn);
})();
