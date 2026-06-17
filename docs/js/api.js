// Client for the Apps Script web app backend.
//
// POST requests are sent as Content-Type: text/plain to avoid CORS preflight
// (Apps Script web apps cannot respond to OPTIONS requests).

window.LLMWikiApi = (function () {
  function gasUrl() {
    return window.LLM_WIKI_CONFIG.GAS_URL;
  }

  function idToken() {
    return window.LLMWikiAuth.getIdToken();
  }

  async function call(action, payload) {
    const response = await fetch(gasUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: action, idToken: idToken(), payload: payload || {} })
    });
    return parseResponse_(response);
  }

  async function get(action, params) {
    const url = new URL(gasUrl());
    url.searchParams.set('action', action);
    url.searchParams.set('idToken', idToken());
    Object.keys(params || {}).forEach(function (k) {
      url.searchParams.set(k, params[k]);
    });
    const response = await fetch(url.toString());
    return parseResponse_(response);
  }

  async function parseResponse_(response) {
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  return {
    listPages: function () { return get('listPages'); },
    getPage: function (pageId) { return get('getPage', { pageId: pageId }); },
    parse: function (payload) { return call('parse', payload); },
    index: function (payload) { return call('index', payload); },
    ask: function (payload) { return call('ask', payload); },
    deletePage: function (payload) { return call('delete', payload); }
  };
})();
