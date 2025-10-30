// === SETTINGS ===
const BARCODE_API_URL = "https://api.barcodelookup.com/v3/products";
const BARCODELOOKUP_API_KEY = "YOURAPIKEY"; // get a free key from barcodelookup.com

// Simple cache to avoid re-hitting the API for the same code
const CACHE_MINUTES = 1440; // 1 day

/**
 * Returns a product title for a given barcode (UPC-A/EAN-13).
 * Usage in Google Sheets: =GET_PRODUCT_TITLE(A2)
 *
 * @param {string|number} code - A UPC-A or EAN-13 barcode.
 * @return {string} Product title (empty string on error or not found).
 */
function GET_PRODUCT_TITLE(code) {
  if (!code) return "";
  const norm = String(code).replace(/\D/g, "");             // keep digits only
  const ean13 = norm.length === 12 ? "0" + norm : norm;     // pad UPC-A to EAN-13
  if (ean13.length !== 13) return "";

  const cache = CacheService.getScriptCache();
  const cached = cache.get(ean13);
  if (cached) return cached;

  const url = `${BARCODE_API_URL}?barcode=${encodeURIComponent(ean13)}&key=${BARCODELOOKUP_API_KEY}`;
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return "";

    const data = JSON.parse(res.getContentText());
    const product = (data && data.products && data.products[0]) || null;
    const title = product ? (product.title || product.product_name || "") : "";
    if (title) cache.put(ean13, title, CACHE_MINUTES * 60);
    return title;
  } catch (e) {
    return "";
  }
}
