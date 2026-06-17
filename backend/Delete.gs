/**
 * Action: delete
 * Input:  { pageId: string }   — Drive file ID of the wiki page to remove
 * Output: { ok: true, title: string }
 *
 * Moves the wiki file to trash and removes its entry from index.json.
 */

function handleDelete_(input) {
  var pageId = input.pageId;
  if (!pageId) throw new Error('pageId is required');

  var file = DriveApp.getFileById(pageId);
  var title = file.getName().replace(/\.md$/i, '');

  // Remove from index.json
  var index = loadIndex_();
  index.pages = index.pages.filter(function (p) { return p.id !== pageId; });
  saveIndex_(index);

  // Append to log
  appendToLog_([{ action: 'delete', title: title, path: file.getName() }]);

  // Trash the file
  file.setTrashed(true);

  return { ok: true, title: title };
}
