const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NormalizedScanCode {
  /** 'qr_uid' → send as qr_uid param; 'code' → send as asset_id (backend cascades to tag_number) */
  type: 'qr_uid' | 'code';
  value: string;
}

/**
 * Normalise raw scanned/typed text into a typed lookup value.
 *
 * Resolution order:
 *   1. Bare UUID                    → { type: 'qr_uid', value }
 *   2. JSON payload with qr_uid     → { type: 'qr_uid', value: parsed.qr_uid }
 *   3. JSON payload with asset_id   → { type: 'code',   value: parsed.asset_id }
 *   4. Plain string (asset_id / barcode / tag_number) → { type: 'code', value }
 */
export function normalizeScannedCode(raw: string): NormalizedScanCode {
  const text = raw.trim();

  if (UUID_RE.test(text)) {
    return { type: 'qr_uid', value: text };
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.qr_uid && UUID_RE.test(String(parsed.qr_uid))) {
        return { type: 'qr_uid', value: String(parsed.qr_uid) };
      }
      if (parsed.asset_id) {
        return { type: 'code', value: String(parsed.asset_id) };
      }
    } catch {
      // not valid JSON — fall through
    }
  }

  return { type: 'code', value: text };
}
