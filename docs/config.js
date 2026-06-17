// Public configuration for the LLM Wiki frontend.
// These values are not secret: the GAS backend independently verifies the
// ID token's audience and checks the caller's email against a whitelist.
window.LLM_WIKI_CONFIG = {
  // Deployed Apps Script web app URL, e.g. https://script.google.com/macros/s/XXXX/exec
  GAS_URL: 'https://script.google.com/macros/s/AKfycbz4X7u8O_2ZDuirqDAfA_QRfdC0z6dC6Q7sw0UtqoQWEtr4Pmf9DkJMlO2o8sdc_0Wn/exec',

  // OAuth 2.0 Web Client ID from Google Cloud Console (must match backend OAUTH_CLIENT_ID)
  GOOGLE_CLIENT_ID: '159971922531-3l36ftk841eqq2opra6h3e28m2h0bpmr.apps.googleusercontent.com',

  // Google API key with Drive/Picker API enabled, used for the file picker (PDF uploads)
  GOOGLE_API_KEY: '%%GOOGLE_API_KEY%%',

  // Apps Script Drive folder id where uploaded PDFs should be picked from/to
  // (the same ROOT_FOLDER_ID configured in the backend's Script Properties)
  DRIVE_ROOT_FOLDER_ID: '1rtwIiVxRt7NmqMzHRe5l6PlF_Lv-Ry8p'
};
