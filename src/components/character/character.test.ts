import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Character } from './Character';

const svg = (p: Parameters<typeof Character>[0]) => renderToStaticMarkup(createElement(Character, p));

describe('Character markup is built from an allowlist (the option comes from the database)', () => {
  it('ignores a mascot option that could break out of an attribute', () => {
    const html = svg({ id: 'x', mascot: 'flask', arg: '#66A3BF" onload="alert(1)' });
    expect(html).not.toContain('onload');
    expect(html).not.toContain('alert');
    expect(html).toContain('<svg');
  });
  it('accepts a normal colour option', () => {
    expect(svg({ id: 'x', mascot: 'flask', arg: '#E57C73' })).toContain('#E57C73');
  });
  it('an unknown or inherited mascot name falls back to the default drop', () => {
    for (const bad of ['constructor', '__proto__', 'toString', 'nope', '<script>']) {
      const html = svg({ id: 'x', mascot: bad });
      expect(html).toContain('<svg');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('[object');
    }
  });
  it('an unknown person falls back safely', () => {
    expect(svg({ id: 'x', mascot: 'person', arg: '__proto__' })).toContain('<svg');
  });
});
