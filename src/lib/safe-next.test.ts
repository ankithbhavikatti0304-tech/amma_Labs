import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/checkout')).toBe('/checkout');
    expect(safeNext('/orders/AL-ABC234?x=1')).toBe('/orders/AL-ABC234?x=1');
  });
  it('blocks open redirects', () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, '/a\nb']) {
      expect(safeNext(bad as string | undefined)).toBe('/');
    }
  });
});
