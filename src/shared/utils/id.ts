function randomHex(bytes: number): string {
  const size = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 8;

  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(size);
    cryptoObj.getRandomValues(buf);
    let out = '';
    for (const value of buf) out += value.toString(16).padStart(2, '0');
    return out;
  }

  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

export function createStableId(prefix: string = 'id', timestampMs: number = Date.now()): string {
  const safePrefix = String(prefix || 'id').replace(/[^a-zA-Z0-9_-]/g, '') || 'id';
  const safeTs = Number.isFinite(timestampMs) ? Math.floor(timestampMs) : Date.now();
  return `${safePrefix}_${safeTs.toString(36)}_${randomHex(8)}`;
}
