/**
 * UPCItemDB Google Sheets Helpers
 * Works with the trial endpoint (no API key) and caches results to reduce calls.
 *
 * Custom functions:
 *   =GET_UPCITEMDB_TITLE(A2)
 *   =GET_UPCITEMDB_FIELD(A2, "brand")
 *   =GET_UPCITEMDB_JSON(A2)
 *
 * Notes:
 * - Trial endpoint: ~100 requests/day and ~5 requests/minute (subject to change).
 * - UPC-A (12 digits) is auto-padded to EAN-13 by adding a leading 0.
 * - Returns empty string on not-found or transient errors (so your sheet stays clean).
 */

const UPCITEMDB_BASE = "https://api.upcitemdb.com/prod/trial/lookup?upc=";
// Cache each lookup for 24h to avoid rate limits.
const CACHE_SECONDS = 24 * 60 * 60;

/** Public: Get product title from UPC/EAN */
function GET_UPCITEMDB_TITLE(code) {
  const item = upcitemdbLookup_(code);
  return item ? (item.title || "") : "";
}

/** Public: Get arbitrary field from the first matched item (e.g., "brand","category","model","size") */
function GET_UPCITEMDB_FIELD(code, field) {
  if (!field) return "";
  const item = upcitemdbLookup_(code);
  return item ? (item[field] ?? "") : "";
}

/** Public: Get compact JSON for the first matched item (for debugging or advanced use) */
function GET_UPCITEMDB_JSON(code) {
  const item = upcitemdbLookup_(code);
  return item ? JSON.stringify(item) : "";
}

/** Core lookup with caching and normalization */
function upcitemdbLookup_(code) {
  const upc = normalizeBarcode_(code);
  if (!upc) return null;

  const cache = CacheService.getScriptCache();
  const cached = cache.get(upc);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  const url = UPCITEMDB_BASE + encodeURIComponent(upc);
  try {
    const res = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" },
      followRedirects: true,
    });
    const status = res.getResponseCode();
    if (status !== 200) {
      // 404 or 429 etc. Return null so the cell stays blank instead of throwing.
      return null;
    }

    const body = res.getContentText();
    const json = JSON.parse(body);

    // UPCItemDB trial payload example:
    // { code: "OK", total: 1, items: [ { title: "...", brand: "...", upc: "...", ... } ] }
    const items = (json && json.items) || [];
    const first = items[0] || null;

    // Cache only successful finds
    if (first) cache.put(upc, JSON.stringify(first), CACHE_SECONDS);

    return first;
  } catch (err) {
    // Network/parse error: fail quietly for Sheets UX
    return null;
  }
}

/** Normalize to digits; if 12-digit UPC-A, pad to 13 by adding leading "0" (EAN-13) */
function normalizeBarcode_(value) {
  if (value == null) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 12 ? "0" + digits : digits;
}
