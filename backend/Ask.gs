/**
 * Action: ask
 * Input:  { question: string }
 * Output: { answer: string, sources: [ { title, path } ] }
 *
 * Two-step retrieval: ask Gemini which index pages are relevant to the
 * question, then feed those pages' full content as long-context to
 * generate the final answer.
 */

var ASK_SELECT_SCHEMA = {
  type: 'object',
  properties: {
    paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'paths (with .md) of the wiki pages most relevant to answering the question, most relevant first.'
    }
  },
  required: ['paths']
};

var MAX_CONTEXT_PAGES = 8;

function handleAsk_(input) {
  const question = input.question;
  if (!question) {
    throw new Error('ask requires question');
  }

  const index = loadIndex_();
  if (index.pages.length === 0) {
    return { answer: '위키에 아직 페이지가 없습니다. 먼저 콘텐츠를 색인해 주세요.', sources: [] };
  }

  const pageSummaries = index.pages.map(function (p) {
    return { path: p.path, title: p.title, summary: p.summary, tags: p.tags };
  });

  const selectPrompt =
    'Given the following wiki page index and a user question, select up to ' + MAX_CONTEXT_PAGES +
    ' pages most relevant to answering the question.\n\n' +
    '## Index\n' + JSON.stringify(pageSummaries, null, 2) + '\n\n' +
    '## Question\n' + question;

  const selectResultText = geminiGenerate_([geminiTextPart_(selectPrompt)], { jsonSchema: ASK_SELECT_SCHEMA, action: 'ask' });
  const selected = JSON.parse(selectResultText).paths.slice(0, MAX_CONTEXT_PAGES);

  const sources = [];
  const contextParts = [];

  selected.forEach(function (path) {
    const entry = index.pages.find(function (p) { return p.path === path; });
    if (!entry) return;
    const content = readFileContent_(entry.id);
    contextParts.push('## ' + entry.title + ' (' + entry.path + ')\n' + content);
    sources.push({ title: entry.title, path: entry.path });
  });

  const answerPrompt =
    'Answer the user question using only the information in the wiki pages below. ' +
    'If the answer is not contained in the pages, say so. ' +
    'Cite which page(s) you used by title at the end. Respond in the same language as the question.\n\n' +
    contextParts.join('\n\n---\n\n') + '\n\n## Question\n' + question;

  const answer = geminiGenerate_([geminiTextPart_(answerPrompt)], { action: 'ask' });

  return { answer: answer, sources: sources };
}
