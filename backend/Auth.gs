/**
 * Verifies a Google ID token (JWT) obtained on the frontend via Google Identity Services.
 * Checks:
 *  - token is valid (per Google's tokeninfo endpoint)
 *  - aud matches our OAuth client ID
 *  - email is in the ALLOWED_EMAILS whitelist
 *
 * Throws on failure. Returns the decoded token payload on success.
 */
function verifyIdToken_(idToken) {
  if (!idToken) {
    throw new AuthError_('Missing idToken');
  }

  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    throw new AuthError_('Invalid idToken');
  }

  const payload = JSON.parse(response.getContentText());

  if (payload.aud !== getOAuthClientId_()) {
    throw new AuthError_('idToken audience mismatch');
  }

  const email = (payload.email || '').toLowerCase();
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new AuthError_('Email not verified');
  }
  if (getAllowedEmails_().indexOf(email) === -1) {
    throw new AuthError_('Email not allowed: ' + email);
  }

  return payload;
}

function AuthError_(message) {
  const error = new Error(message);
  error.isAuthError = true;
  return error;
}
