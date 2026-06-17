/**
 * Action: parse
 * Input:  { type: 'url'|'youtube'|'pdf'|'text', payload: string, fileId?: string }
 *   - url:     payload = web page URL
 *   - youtube: payload = YouTube video URL
 *   - pdf:     fileId  = Drive file ID of an uploaded PDF (payload optional, ignored)
 *   - text:    payload = raw text/markdown content
 * Output: { rawId: string, title: string, preview: string }
 *
 * Uses Gemini to convert the source into clean raw markdown, then stores it
 * in the raw/ folder as <title-slug>.md.
 */

var PARSE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short descriptive title for this source, used as the filename.' },
    markdown: { type: 'string', description: 'The full content rewritten as clean markdown.' }
  },
  required: ['title', 'markdown']
};

function handleParse_(input) {
  const type = input.type;
  let parts;

  switch (type) {
    case 'url':
      parts = buildUrlParseParts_(input.payload);
      break;
    case 'youtube':
      parts = buildYoutubeParseParts_(input.payload);
      break;
    case 'pdf':
      parts = buildPdfParseParts_(input.fileId);
      break;
    case 'text':
      parts = buildTextParseParts_(input.payload);
      break;
    default:
      throw new Error('Unknown parse type: ' + type);
  }

  let resultText;
  if (type === 'url') {
    // Step 1: fetch page content with url_context (no JSON mode — incompatible)
    const rawText = geminiGenerate_(parts, { tools: [geminiUrlContextTool_()], action: 'parse' });
    // Step 2: structure the extracted text as JSON
    resultText = structureRawText_(rawText);
  } else {
    resultText = geminiGenerate_(parts, { jsonSchema: PARSE_RESPONSE_SCHEMA, action: 'parse' });
  }
  const result = JSON.parse(resultText);

  const rawFolder = getRawFolder_();
  const file = createMdFile_(rawFolder, slugify_(result.title), result.markdown);

  return {
    rawId: file.getId(),
    title: result.title,
    preview: result.markdown.substring(0, 500)
  };
}

function buildUrlParseParts_(url) {
  // url_context tool cannot be combined with JSON response mode.
  // Step 1: fetch and extract content as plain text using url_context.
  // Step 2 (in handleParse_): convert the text to structured JSON without tools.
  return [geminiTextPart_(
    'Fetch the content at the following URL and extract its main content as clean markdown. ' +
    'Remove navigation, ads, and boilerplate. Output only the markdown text, no commentary.\n\nURL: ' + url
  )];
}

function structureRawText_(rawText) {
  const prompt =
    'Convert the following content into a structured wiki entry. ' +
    'Respond with JSON matching the schema.\n\n---\n\n' + rawText;
  return geminiGenerate_([geminiTextPart_(prompt)], { jsonSchema: PARSE_RESPONSE_SCHEMA, action: 'parse' });
}

function buildYoutubeParseParts_(url) {
  return [
    geminiFileDataPart_('video/*', url),
    geminiTextPart_(
      'Watch this video and produce a clean markdown summary of its content, ' +
      'organized with headings and bullet points covering the key points and topics discussed. ' +
      'Respond with JSON matching the schema.'
    )
  ];
}

function buildPdfParseParts_(fileId) {
  if (!fileId) {
    throw new Error('pdf parse requires fileId');
  }
  const blob = DriveApp.getFileById(fileId).getBlob();
  return [
    geminiInlineDataPart_(blob),
    geminiTextPart_(
      'Convert this document into clean, well-structured markdown, preserving headings, ' +
      'lists, and tables where present. Respond with JSON matching the schema.'
    )
  ];
}

function buildTextParseParts_(text) {
  return [geminiTextPart_(
    'Clean up and reformat the following content into well-structured markdown ' +
    '(fix headings, lists, formatting) without changing its meaning. ' +
    'Respond with JSON matching the schema.\n\n---\n\n' + text
  )];
}

/** Converts a title into a filesystem-safe slug. */
function slugify_(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmmss');
  return (base || 'source') + '-' + timestamp;
}
