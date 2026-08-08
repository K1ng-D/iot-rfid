export function normalizeRfidUid(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[\s:-]/g, "")
    .toUpperCase();
}

export function isValidRfidUid(value: unknown): boolean {
  const uid = normalizeRfidUid(value);

  /*
   * UID yang umum digunakan MFRC522:
   *
   * 4 byte  = 8 karakter hexadecimal
   * 7 byte  = 14 karakter hexadecimal
   * 10 byte = 20 karakter hexadecimal
   */
  return /^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(uid);
}

export function sanitizeText(value: unknown, maxLength = 150): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function sanitizeWifiRssi(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}
