import { longDate } from './ist';

/** Order status helpers shared by server and browser. */
export const STATUS_STEPS = ['Booked', 'Sample collected', 'Processing at lab', 'Report ready'] as const;

export type OrderStatusName = 'PENDING_PAYMENT' | 'BOOKED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'REPORT_READY' | 'CANCELLED';

/** Position on the four-step tracker; -1 when the order isn't on it (awaiting payment, cancelled). */
export function statusIndex(s: OrderStatusName): number {
  switch (s) {
    case 'BOOKED': return 0;
    case 'SAMPLE_COLLECTED': return 1;
    case 'PROCESSING': return 2;
    case 'REPORT_READY': return 3;
    default: return -1;
  }
}

export interface OrderDTO {
  id: string;
  code: string;
  status: OrderStatusName;
  payMode: 'COD' | 'ONLINE';
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  items: { testId: string; name: string; price: number }[];
  /** YYYY-MM-DD */
  slotDate: string;
  slotLabel: string;
  homeCollection: boolean;
  addressLine: string | null;
  pincode: string | null;
  city: string;
  patientName: string;
  patientAge: number;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  mrpTotal: number;
  priceTotal: number;
  couponCode: string | null;
  couponDiscount: number;
  collectionFee: number;
  hardCopyFee: number;
  total: number;
  hardCopy: boolean;
  createdAt: string;
  hasReport: boolean;
  /** Patients can cancel until the sample is collected. */
  cancellable: boolean;
  /** For an unpaid online order: when its slot hold runs out. */
  holdExpiresAt: string | null;
}

export const GENDER_LABEL = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' } as const;

/** "Thu, 8 Oct, 10 am–12 pm" */
export const slotText = (o: { slotDate: string; slotLabel: string }) => `${longDate(o.slotDate)}, ${o.slotLabel}`;
