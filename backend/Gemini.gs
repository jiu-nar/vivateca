/**
 * Thin wrapper around the Gemini REST API (generateContent).
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */

var GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

/**
 * @param {Array} parts - array of Gemini "part" objects, e.g.
 *   { text: '...' }
 *   { inline_data: { mime_type: 'application/pdf', data: '<base64>' } }
 *   { file_data: { mime_type: 'video/*', file_uri: 'https://www.youtube.com/watch?v=...' } }
 * @param {Object} [options]
 *   - tools: e.g. [{ url_context: {} }]
 *   - jsonSchema: if set, requests application/json output with this schema
 *   - action: 'parse'|'index'|'ask' - selects a per-action API key if configured
 *     (GEMINI_API_KEY_PARSE / GEMINI_API_KEY_INDEX / GEMINI_API_KEY_ASK),
 *     falling back to GEMINI_API_KEY. Lets usage be tracked separately per action.
 * @returns {string} the text of the first candidate
 */
function geminiGenerate_(parts, options) {
  options = options || {};
  const model = getGeminiModel_();
  const url = GEMINI_BASE_URL + model + ':generateContent?key=' + getGeminiApiKey_(options.action);

  const body = {
    contents: [{ parts: parts }]
  };

  if (options.tools) {
    body.tools = options.tools;
  }

  if (options.jsonSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: options.jsonSchema
    };
  }

  const fetchOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  let response, code, text;
  const retryDelays = [5000, 15000]; // 5초, 15초 후 재시도
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    response = UrlFetchApp.fetch(url, fetchOptions);
    code = response.getResponseCode();
    text = response.getContentText();
    if (code !== 503 && code !== 429) break;
    if (attempt < retryDelays.length) {
      Utilities.sleep(retryDelays[attempt]);
    }
  }

  if (code !== 200) {
    throw new Error('Gemini API error (' + code + '): ' + text);
  }

  const data = JSON.parse(text);
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new Error('Gemini API returned no content: ' + text);
  }

  return candidate.content.parts.map(function (p) { return p.text || ''; }).join('');
}

/** Builds a text part. */
function geminiTextPart_(text) {
  return { text: text };
}

/** Builds an inline_data part from a Drive Blob. */
function geminiInlineDataPart_(blob) {
  return {
    inline_data: {
      mime_type: blob.getContentType(),
      data: Utilities.base64Encode(blob.getBytes())
    }
  };
}

/** Builds a file_data part pointing at a remote URI (e.g. YouTube video URL). */
function geminiFileDataPart_(mimeType, fileUri) {
  return {
    file_data: {
      mime_type: mimeType,
      file_uri: fileUri
    }
  };
}

/** Tool enabling Gemini to fetch and read web page content directly from URLs. */
function geminiUrlContextTool_() {
  return { url_context: {} };
}
