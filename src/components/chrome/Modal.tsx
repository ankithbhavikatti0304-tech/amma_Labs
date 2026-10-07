'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Mount on open, unmount after the close animation. `shown` drives the CSS transition. */
function usePresence(open: boolean, ms: number) {
  const [prevOpen, setPrevOpen] = useState(open);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  // React to `open` flipping while rendering (the supported way to derive state from a changing prop).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setExiting(false);
    else { setEntered(false); setExiting(true); }
  }
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setExiting(false), ms);
    return () => clearTimeout(t);
  }, [exiting, ms]);
  return { mounted: open || exiting, shown: open && entered };
}

/**
 * Accessible modal: role=dialog, focus moves in and is trapped, Esc closes, focus returns to
 * the opener, the page behind is made inert and doesn't scroll.
 */
export function Modal({ open, onClose, label, variant = 'sheet', children }: { open: boolean; onClose: () => void; label: string; variant?: 'sheet' | 'palette'; children: ReactNode }) {
  const { mounted, shown } = usePresence(open, 180);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const root = document.getElementById('app-root');
    root?.setAttribute('inert', '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = setTimeout(() => {
      const el = box.current?.querySelector<HTMLElement>('input,button:not(.x),a[href]');
      el?.focus();
    }, 30);
    return () => {
      clearTimeout(focus);
      root?.removeAttribute('inert');
      document.body.style.overflow = prevOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Tab') {
      const nodes = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className={`scrim ${variant === 'palette' ? 'pal-scrim' : ''} ${shown ? 'show' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={onKeyDown}>
      <div ref={box} className={variant === 'palette' ? 'pal' : 'sheet'} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function SheetHead({ title, sub, onClose }: { title: ReactNode; sub?: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-h">
      <div>
        <h2>{title}</h2>
        {sub ? <p className="muted" style={{ margin: '4px 0 0' }}>{sub}</p> : null}
      </div>
      <button className="x" onClick={onClose} aria-label="Close" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
