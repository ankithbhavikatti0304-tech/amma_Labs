/** Indian rupee formatting with en-IN digit grouping: ₹1,23,456. Amounts are whole rupees. */
export const inr = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN');
