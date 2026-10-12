import type { FieldDef } from './AdminForm';
import { M } from '@/components/character/builders';

const MASCOTS = Object.keys(M).filter((k) => k !== 'family');

export const testFields = (categories: { id: string; name: string }[]): FieldDef[] => [
  { name: 'name', label: 'Name', type: 'text', maxLength: 140 },
  { name: 'price', label: 'Selling price (₹)', type: 'number' },
  { name: 'mrp', label: 'MRP (₹)', type: 'number', hint: 'The struck-through price. Same as the selling price for no discount.' },
  { name: 'tatMinHours', label: 'Report in, fastest (hours)', type: 'number' },
  { name: 'tatMaxHours', label: 'Report in, slowest (hours)', type: 'number' },
  { name: 'parameterCount', label: 'Number of tests included', type: 'number', hint: 'Shown as “88 tests” on packages. Leave blank for a single test.' },
  { name: 'tint', label: 'Card colour', type: 'select', options: [{ value: 'a', label: 'Mint' }, { value: 'b', label: 'Sky' }, { value: 'c', label: 'Sand' }] },
  { name: 'mascot', label: 'Character', type: 'select', options: MASCOTS.map((m) => ({ value: m, label: m })) },
  { name: 'mascotArg', label: 'Character option', type: 'text', hint: 'Optional: a colour like #66A3BF for flasks, or 1 for a variant.' },
  { name: 'categories', label: 'Categories', type: 'checks', options: categories.map((c) => ({ value: c.id, label: c.name })) },
  { name: 'includes', label: 'What it includes (one per line)', type: 'textarea', rows: 6 },
  { name: 'isPackage', label: 'This is a package', type: 'checkbox' },
  { name: 'fasting', label: 'Needs 10–12 hours of fasting', type: 'checkbox' },
  { name: 'morningSample', label: 'Needs a morning sample', type: 'checkbox' },
  { name: 'centreVisit', label: 'Done at the centre (no home collection)', type: 'checkbox' },
  { name: 'popular', label: 'Show as popular', type: 'checkbox' },
  { name: 'active', label: 'Available to book', type: 'checkbox', hint: 'Untick to hide it. Past orders are not affected.' },
];

export const parameterFields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', maxLength: 100 },
  { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'NUMERIC', label: 'Number with a range' }, { value: 'CHOICE', label: 'One of a list (Negative / Positive)' }, { value: 'TEXT', label: 'Free-text finding' }] },
  { name: 'unit', label: 'Unit', type: 'text', maxLength: 30 },
  { name: 'decimals', label: 'Decimal places', type: 'number' },
  { name: 'refLow', label: 'Normal from', type: 'number', hint: 'Adult default. Add sex or age rules below.' },
  { name: 'refHigh', label: 'Normal up to', type: 'number' },
  { name: 'options', label: 'Options (one per line)', type: 'textarea', rows: 3, hint: 'For “one of a list” only.' },
  { name: 'refText', label: 'Which option is normal', type: 'text', maxLength: 60 },
];

export const couponFields: FieldDef[] = [
  { name: 'description', label: 'Description shown to patients', type: 'text', maxLength: 120 },
  { name: 'type', label: 'Type', type: 'select', options: [{ value: 'PERCENT', label: 'Percent off' }, { value: 'FLAT', label: 'Flat ₹ off' }] },
  { name: 'value', label: 'Value (% or ₹)', type: 'number' },
  { name: 'cap', label: 'Maximum discount (₹)', type: 'number', hint: 'Percent coupons only. Blank for no cap.' },
  { name: 'minOrder', label: 'Minimum basket (₹)', type: 'number' },
  { name: 'maxUses', label: 'Total uses allowed', type: 'number', hint: 'Blank for unlimited.' },
  { name: 'startsAt', label: 'First day', type: 'date' },
  { name: 'endsAt', label: 'Last day', type: 'date' },
  { name: 'active', label: 'Active', type: 'checkbox' },
];
