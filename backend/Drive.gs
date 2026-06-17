/**
 * Drive layout (under ROOT_FOLDER_ID):
 *   wiki/        - finished wiki pages (*.md)
 *   raw/         - raw parsed markdown, one file per source
 *   index.json   - { pages: [ { id, title, path, summary, tags, links, updatedAt } ] }
 */

var WIKI_FOLDER_NAME = 'wiki';
var RAW_FOLDER_NAME = 'raw';
var INDEX_FILE_NAME = 'index.json';

function getRootFolder_() {
  return DriveApp.getFolderById(getRootFolderId_());
}

function getOrCreateSubFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) {
    return it.next();
  }
  return parent.createFolder(name);
}

function getWikiFolder_() {
  return getOrCreateSubFolder_(getRootFolder_(), WIKI_FOLDER_NAME);
}

function getRawFolder_() {
  return getOrCreateSubFolder_(getRootFolder_(), RAW_FOLDER_NAME);
}

/** Creates a new markdown file in the given folder. Returns the File. */
function createMdFile_(folder, name, content) {
  return folder.createFile(name + '.md', content, MimeType.PLAIN_TEXT);
}

/** Reads a file's text content by its Drive file ID. */
function readFileContent_(fileId) {
  return DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');
}

/** Overwrites a file's content by its Drive file ID. */
function writeFileContent_(fileId, content) {
  DriveApp.getFileById(fileId).setContent(content);
}

/** Lists all wiki pages as { id, name } */
function listWikiFiles_() {
  const folder = getWikiFolder_();
  const it = folder.getFiles();
  const out = [];
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().toLowerCase().endsWith('.md')) {
      out.push({ id: f.getId(), name: f.getName() });
    }
  }
  return out;
}

function findFileByNameInFolder_(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

/** Loads index.json from the root folder. Returns { pages: [] } if missing. */
function loadIndex_() {
  const root = getRootFolder_();
  const file = findFileByNameInFolder_(root, INDEX_FILE_NAME);
  if (!file) {
    return { pages: [] };
  }
  const text = file.getBlob().getDataAsString('UTF-8');
  try {
    const parsed = JSON.parse(text);
    if (!parsed.pages) parsed.pages = [];
    return parsed;
  } catch (e) {
    return { pages: [] };
  }
}

var LOG_FILE_NAME = 'log.md';

/** Returns the public Drive viewer URL for a file ID. */
function driveViewUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

/**
 * Builds an OKF-compliant YAML frontmatter block.
 * Returns the block as a string ending with a newline, ready to prepend to body content.
 * opts.source: Drive URL of the raw source file this page was generated from.
 */
function buildFrontmatter_(type, title, description, tags, timestamp, opts) {
  opts = opts || {};
  const tagsYaml = (tags && tags.length)
    ? '[' + tags.map(function (t) { return '"' + t.replace(/"/g, '\\"') + '"'; }).join(', ') + ']'
    : '[]';
  let fm = '---\n' +
    'type: ' + type + '\n' +
    'title: ' + title + '\n' +
    'description: ' + description.replace(/\n/g, ' ') + '\n' +
    'tags: ' + tagsYaml + '\n' +
    'timestamp: ' + timestamp + '\n';
  if (opts.source) {
    fm += 'source: ' + opts.source + '\n';
  }
  fm += '---\n\n';
  return fm;
}

/**
 * Writes (or overwrites) a simple frontmatter block on a raw file to record
 * which wiki pages were generated from it.
 * generatedPages: [{ title, path }]
 */
function annotateRawFile_(rawFileId, generatedPages) {
  const file = DriveApp.getFileById(rawFileId);
  const existing = file.getBlob().getDataAsString('UTF-8');

  // Strip any existing frontmatter before re-writing.
  const stripped = existing.startsWith('---\n')
    ? existing.replace(/^---\n[\s\S]*?\n---\n\n?/, '')
    : existing;

  const pageList = generatedPages.map(function (p) {
    return '  - title: "' + p.title.replace(/"/g, '\\"') + '"\n    path: "' + p.path + '"';
  }).join('\n');

  const fm = '---\n' +
    'type: RawSource\n' +
    'generated_pages:\n' + pageList + '\n' +
    '---\n\n';

  file.setContent(fm + stripped);
}

/**
 * Appends entries for today to log.md in the root folder (creates if missing).
 * entries: [{ action: 'create'|'update', title: string, path: string }]
 */
function appendToLog_(entries) {
  if (!entries || entries.length === 0) return;

  const root = getRootFolder_();
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const lines = entries.map(function (e) {
    const verb = e.action === 'create' ? '**Creation**' : '**Update**';
    return '* ' + verb + ': [' + e.title + '](wiki/' + e.path + ')';
  });

  const newSection = '\n## ' + today + '\n' + lines.join('\n') + '\n';

  const file = findFileByNameInFolder_(root, LOG_FILE_NAME);
  if (!file) {
    const header = '# Wiki Update Log\n';
    root.createFile(LOG_FILE_NAME, header + newSection, MimeType.PLAIN_TEXT);
    return;
  }

  const existing = file.getBlob().getDataAsString('UTF-8');

  // If today's section already exists, insert entries after its heading.
  const todayHeading = '## ' + today;
  if (existing.indexOf(todayHeading) !== -1) {
    const updated = existing.replace(
      todayHeading + '\n',
      todayHeading + '\n' + lines.join('\n') + '\n'
    );
    file.setContent(updated);
  } else {
    // Prepend new date section after the first-line header.
    const firstNewline = existing.indexOf('\n');
    const header = firstNewline !== -1 ? existing.substring(0, firstNewline + 1) : existing;
    const rest = firstNewline !== -1 ? existing.substring(firstNewline + 1) : '';
    file.setContent(header + newSection + rest);
  }
}

/** Saves the index object to index.json in the root folder (creates if missing). */
function saveIndex_(indexObj) {
  const root = getRootFolder_();
  const content = JSON.stringify(indexObj, null, 2);
  const file = findFileByNameInFolder_(root, INDEX_FILE_NAME);
  if (file) {
    file.setContent(content);
  } else {
    root.createFile(INDEX_FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}
