import { describe, expect, it } from 'vitest';
import { cleanFileName, sniff } from './files';

describe('sniff', () => {
  it('recognises real JPEG, PNG, WebP and PDF by their bytes', () => {
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime).toBe('image/jpeg');
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe('image/png');
    expect(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]))?.mime).toBe('image/webp');
    expect(sniff(Buffer.from('%PDF-1.7\n'))?.mime).toBe('application/pdf');
  });
  it('refuses anything else, whatever its name says', () => {
    expect(sniff(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniff(Buffer.from('MZ\x90\x00'))).toBeNull(); // Windows executable
    expect(sniff(Buffer.from('GIF89a'))).toBeNull();
    expect(sniff(Buffer.alloc(0))).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('drops paths and control characters', () => {
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
    expect(cleanFileName('C:\\Users\\me\\rx.pdf')).toBe('rx.pdf');
    expect(cleanFileName('a<b>\u0000c.png')).toBe('abc.png');
    expect(cleanFileName('   ')).toBe('file');
    expect(cleanFileName('x'.repeat(300)).length).toBe(100);
  });
});
