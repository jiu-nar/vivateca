/**
 * One-time setup helper. Run setup_() once from the Apps Script editor after
 * setting the following Script Properties (Project Settings > Script Properties):
 *   GEMINI_API_KEY   - your Gemini API key
 *   OAUTH_CLIENT_ID  - OAuth 2.0 Web client ID (for Google Identity Services login)
 *   ALLOWED_EMAILS   - comma-separated whitelist, e.g. "you@gmail.com"
 *   GEMINI_MODEL     - optional, defaults to gemini-2.5-flash
 *
 * This function creates the root "LLM-Wiki" folder (if ROOT_FOLDER_ID is not
 * already set), its wiki/ and raw/ subfolders, and an empty index.json.
 */
function setup() {
  let rootFolderId = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  let root;

  if (rootFolderId) {
    root = DriveApp.getFolderById(rootFolderId);
  } else {
    root = DriveApp.createFolder('LLM-Wiki');
    PropertiesService.getScriptProperties().setProperty('ROOT_FOLDER_ID', root.getId());
  }

  getOrCreateSubFolder_(root, WIKI_FOLDER_NAME);
  getOrCreateSubFolder_(root, RAW_FOLDER_NAME);

  if (!findFileByNameInFolder_(root, INDEX_FILE_NAME)) {
    saveIndex_({ pages: [] });
  }

  Logger.log('Root folder: %s (%s)', root.getName(), root.getId());
}
