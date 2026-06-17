// Google sign-in (Identity Services) for the LLM Wiki frontend.
//
// - ID token (JWT): sent with every API call so the backend can verify
//   the caller's identity against its email whitelist.
// - Access token (OAuth): requested on demand, used only for the Google
//   Picker (uploading PDFs to Drive).

window.LLMWikiAuth = (function () {
  const STORAGE_KEY = 'llm_wiki_id_token';
  let idToken = localStorage.getItem(STORAGE_KEY) || null;
  let tokenClient = null;
  let onSignInCallback = null;

  function init(onSignIn) {
    onSignInCallback = onSignIn;

    google.accounts.id.initialize({
      client_id: window.LLM_WIKI_CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'outline', size: 'medium' }
    );

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.LLM_WIKI_CONFIG.GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: '' // set per-request in getAccessToken
    });

    if (idToken) {
      onSignInCallback && onSignInCallback();
    }
  }

  function handleCredentialResponse(response) {
    idToken = response.credential;
    localStorage.setItem(STORAGE_KEY, idToken);
    onSignInCallback && onSignInCallback();
  }

  function getIdToken() {
    return idToken;
  }

  function isSignedIn() {
    return !!idToken;
  }

  function signOut() {
    idToken = null;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /** Returns a Promise<string> resolving to an OAuth access token (Drive scope). */
  function getAccessToken() {
    return new Promise(function (resolve, reject) {
      tokenClient.callback = function (resp) {
        if (resp.error) {
          reject(resp);
        } else {
          resolve(resp.access_token);
        }
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  return {
    init: init,
    getIdToken: getIdToken,
    isSignedIn: isSignedIn,
    signOut: signOut,
    getAccessToken: getAccessToken
  };
})();
