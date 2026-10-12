/** URL-safe slug, e.g. "Vitamin D & B12 Combo" → "vitamin-d-and-b12-combo". Capped at `max` chars on a word boundary. */
export function slugify(input: string, max = 70): string {
  const s = input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical asides, they make slugs very long
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf('-');
  return at > 20 ? cut.slice(0, at) : cut;
}
