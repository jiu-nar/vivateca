/**
 * Action: index
 * Input:  { rawId: string }
 * Output: { pages: [ { fileName, title, action } ] }
 *
 * Reads a raw parsed markdown file and, using the current index as context,
 * asks Gemini to create new wiki pages and/or update existing ones to fit
 * the wiki's topic structure. Writes the resulting pages to wiki/ and
 * updates index.json.
 */

var WIKI_PAGE_TYPES = ['Concept', 'Summary', 'How-to', 'Reference', 'Note'];

var INDEX_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update'], description: '"update" only if fileName matches an existing page exactly.' },
          fileName: { type: 'string', description: 'Wiki page file name without extension, kebab-case.' },
          pageType: { type: 'string', enum: ['Concept', 'Summary', 'How-to', 'Reference', 'Note'], description: 'Concept: explains what something is. Summary: condensed from source material. How-to: procedural steps. Reference: lookup/cheatsheet. Note: short personal note.' },
          title: { type: 'string' },
          content: { type: 'string', description: 'Markdown body only — no frontmatter, that is added automatically.' },
          summary: { type: 'string', description: 'One or two sentence summary for the index.' },
          tags: { type: 'array', items: { type: 'string' } },
          links: { type: 'array', items: { type: 'string' }, description: 'fileName (without extension) of related wiki pages.' }
        },
        required: ['action', 'fileName', 'pageType', 'title', 'content', 'summary', 'tags', 'links']
      }
    }
  },
  required: ['pages']
};

function handleIndex_(input) {
  if (!input.rawId) {
    throw new Error('index requires rawId');
  }

  const rawContent = readFileContent_(input.rawId);
  const index = loadIndex_();

  const existingPagesSummary = index.pages.map(function (p) {
    return { fileName: p.path.replace(/\.md$/, ''), title: p.title, summary: p.summary, tags: p.tags };
  });

  const prompt =
    'You maintain a personal knowledge wiki stored as markdown files. ' +
    'Below is the existing wiki index (page list with summaries) followed by new raw ' +
    'source content. Decide how to incorporate the new content:\n' +
    '- Prefer updating an existing page (action "update", fileName must exactly match an existing one) ' +
    'if the new content fits its topic.\n' +
    '- Otherwise create one or more new pages (action "create") with focused topics.\n' +
    '- For "update", return the FULL new content of the page (merged with existing info, not just the new part).\n' +
    '- Use kebab-case fileNames, write content in Korean unless the source is primarily in another language.\n' +
    '- Pick pageType: Concept (개념 설명), Summary (소스 요약), How-to (절차/방법), Reference (참고/치트시트), Note (단편 메모).\n' +
    '- Return the markdown body only in "content" — do NOT include frontmatter.\n\n' +
    '## Existing index\n' + JSON.stringify(existingPagesSummary, null, 2) + '\n\n' +
    '## New raw source content\n' + rawContent;

  const resultText = geminiGenerate_([geminiTextPart_(prompt)], { jsonSchema: INDEX_RESPONSE_SCHEMA, action: 'index' });
  const result = JSON.parse(resultText);

  const wikiFolder = getWikiFolder_();
  const output = [];
  const logEntries = [];

  result.pages.forEach(function (page) {
    const path = page.fileName + '.md';
    let existingEntry = index.pages.find(function (p) { return p.path === path; });

    const now = new Date().toISOString();
    const fullContent = buildFrontmatter_(page.pageType, page.title, page.summary, page.tags, now, { source: driveViewUrl_(input.rawId) }) + page.content;

    let fileId;
    if (page.action === 'update' && existingEntry) {
      writeFileContent_(existingEntry.id, fullContent);
      fileId = existingEntry.id;
    } else {
      let file = findFileByNameInFolder_(wikiFolder, path);
      if (file) {
        file.setContent(fullContent);
        fileId = file.getId();
      } else {
        file = wikiFolder.createFile(path, fullContent, MimeType.PLAIN_TEXT);
        fileId = file.getId();
      }
    }

    const entry = {
      id: fileId,
      type: page.pageType,
      title: page.title,
      path: path,
      summary: page.summary,
      tags: page.tags || [],
      links: page.links || [],
      updatedAt: now
    };

    if (existingEntry) {
      Object.assign(existingEntry, entry);
    } else {
      index.pages.push(entry);
    }

    const actionLabel = existingEntry ? 'update' : 'create';
    output.push({ fileName: page.fileName, title: page.title, action: actionLabel });
    logEntries.push({ action: actionLabel, title: page.title, path: path });
  });

  saveIndex_(index);
  appendToLog_(logEntries);
  annotateRawFile_(input.rawId, output.map(function (p) { return { title: p.title, path: p.fileName + '.md' }; }));

  return { pages: output };
}
