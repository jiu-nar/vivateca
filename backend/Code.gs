/**
 * Web app entry points.
 *
 * doGet  - read-only actions (health, listPages, getPage), auth via ?idToken=
 * doPost - mutating / LLM actions (parse, index, ask), auth via JSON body { idToken }
 *
 * The frontend sends POST bodies as Content-Type: text/plain to avoid CORS
 * preflight (which Apps Script web apps cannot handle).
 */

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'health') {
      return jsonResponse_({ ok: true });
    }

    verifyIdToken_(e.parameter.idToken);

    switch (action) {
      case 'listPages':
        return jsonResponse_({ pages: loadIndex_().pages });
      case 'getPage':
        return jsonResponse_({ content: readFileContent_(e.parameter.pageId) });
      default:
        throw new Error('Unknown action: ' + action);
    }
  } catch (err) {
    return errorResponse_(err);
  }
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    verifyIdToken_(req.idToken);

    switch (req.action) {
      case 'parse':
        return jsonResponse_(handleParse_(req.payload || {}));
      case 'index':
        return jsonResponse_(handleIndex_(req.payload || {}));
      case 'ask':
        return jsonResponse_(handleAsk_(req.payload || {}));
      default:
        throw new Error('Unknown action: ' + req.action);
    }
  } catch (err) {
    return errorResponse_(err);
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(err) {
  const status = err.isAuthError ? 401 : 500;
  return jsonResponse_({ error: err.message || String(err), status: status });
}
