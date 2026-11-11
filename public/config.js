/*
 * Runtime settings - can be edited after the build, no rebuild needed.
 * API_URL:     address of the backend on your cPanel server, e.g. "https://api.yourdomain.com" (no trailing slash).
 * WEBSITE_URL: address of the customer website; store QR codes point here.
 * Leave empty in local development (the dev server proxies /api to the backend; QR codes use VITE_WEBSITE_URL).
 */
window.APP_CONFIG = {
  API_URL: '',
  WEBSITE_URL: '',
};
