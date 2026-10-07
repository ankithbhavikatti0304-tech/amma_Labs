/** Only follow redirects to a path on this site. Blocks //evil.example and https://evil.example. */
export function safeNext(next: string | string[] | undefined | null, fallback = '/'): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\u0000-\u001f]/.test(v)) return fallback;
  return v;
}
