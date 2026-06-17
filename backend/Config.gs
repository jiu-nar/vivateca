/**
 * Centralized access to Script Properties.
 * Set these once via Project Settings > Script Properties, or run setup() in Setup.gs.
 */

function getProp_(key, required) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !value) {
    throw new Error('Missing required script property: ' + key);
  }
  return value;
}

/**
 * Returns the Gemini API key for a given action (parse/index/ask), falling
 * back to GEMINI_API_KEY if no action-specific key is set. This allows
 * tracking usage separately per action via Google AI Studio's per-key
 * usage dashboard.
 */
function getGeminiApiKey_(action) {
  if (action) {
    const specific = getProp_('GEMINI_API_KEY_' + action.toUpperCase(), false);
    if (specific) return specific;
  }
  return getProp_('GEMINI_API_KEY', true);
}

function getGeminiModel_() {
  return getProp_('GEMINI_MODEL', false) || 'gemini-2.5-flash';
}

function getRootFolderId_() {
  return getProp_('ROOT_FOLDER_ID', true);
}

function getOAuthClientId_() {
  return getProp_('OAUTH_CLIENT_ID', true);
}

function getAllowedEmails_() {
  const raw = getProp_('ALLOWED_EMAILS', true);
  return raw.split(',').map(function (s) { return s.trim().toLowerCase(); });
}
