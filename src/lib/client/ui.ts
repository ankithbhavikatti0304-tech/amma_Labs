'use client';
import { useSyncExternalStore } from 'react';
import { createStore } from './store';

/* ---------- toast ---------- */
interface ToastState { id: number; msg: string }
const toastStore = createStore<ToastState | null>(null);
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  clearTimeout(toastTimer);
  toastStore.set({ id: ++toastId, msg });
  toastTimer = setTimeout(() => toastStore.set(null), 2200);
}
export const useToast = () => useSyncExternalStore(toastStore.subscribe, toastStore.get, () => null);

/* ---------- sheets (modal dialogs) ---------- */
export type SheetState =
  | { kind: 'login'; next?: string; afterLogin?: 'upload' }
  | { kind: 'call' }
  | { kind: 'detail'; id: string }
  | { kind: 'upload' }
  | null;

const sheetStore = createStore<SheetState>(null);
export const openSheet = (s: NonNullable<SheetState>) => sheetStore.set(s);
export const closeSheet = () => sheetStore.set(null);
export const useSheet = () => useSyncExternalStore(sheetStore.subscribe, sheetStore.get, () => null);

/* ---------- search palette ---------- */
const paletteStore = createStore(false);
export const openPalette = () => paletteStore.set(true);
export const closePalette = () => paletteStore.set(false);
export const usePaletteOpen = () => useSyncExternalStore(paletteStore.subscribe, paletteStore.get, () => false);
