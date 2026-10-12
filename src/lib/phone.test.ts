import { describe, expect, it } from 'vitest';
import { formatPhone, isValidPhone, isValidPincode, maskPhone, normalizePhone } from './phone';

describe('phone', () => {
  it('normalises pasted numbers', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('098765-43210')).toBe('9876543210');
    expect(normalizePhone('98765 43210')).toBe('9876543210');
  });
  it('accepts only 10-digit numbers starting 6–9', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('5876543210')).toBe(false);
    expect(isValidPhone('987654321')).toBe(false);
    expect(isValidPhone('98765432100')).toBe(false);
    expect(isValidPhone('98765abcde')).toBe(false);
  });
  it('formats and masks', () => {
    expect(formatPhone('9876543210')).toBe('98765 43210');
    expect(maskPhone('9876543210')).toBe('98••••3210');
  });
  it('validates 6-digit pincodes', () => {
    expect(isValidPincode('560001')).toBe(true);
    expect(isValidPincode('060001')).toBe(false);
    expect(isValidPincode('56000')).toBe(false);
  });
});
