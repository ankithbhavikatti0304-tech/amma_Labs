/** Indian mobile numbers: 10 digits starting 6–9. Stored without +91. */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export const isValidPhone = (p: string): boolean => /^[6-9]\d{9}$/.test(p);

/** 98765 43210 */
export const formatPhone = (p: string): string => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

/** Mask for logs and support screens: 98••••3210 */
export const maskPhone = (p: string): string => (p.length === 10 ? `${p.slice(0, 2)}••••${p.slice(-4)}` : '••••');

/** Six digits, not starting with 0. */
export const isValidPincode = (p: string): boolean => /^[1-9]\d{5}$/.test(p);
