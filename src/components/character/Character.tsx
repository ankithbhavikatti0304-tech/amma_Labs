import { M, PPL, hash, person } from './builders';

export type CharSize = '' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Characters that aren't tied to a test or category (used on the home page). */
const FIXED: Record<string, { mascot: string; arg?: string; tint: 'a' | 'b' | 'c' }> = {
  nurse: { mascot: 'person', arg: 'nurse', tint: 'b' },
  swom: { mascot: 'person', arg: 'swom', tint: 'a' },
  madv: { mascot: 'person', arg: 'madv', tint: 'b' },
  faw: { mascot: 'person', arg: 'faw', tint: 'a' },
  booking: { mascot: 'phone', tint: 'b' },
  report: { mascot: 'clip', tint: 'c' },
};

export interface CharacterProps {
  /** Seeds the animation offset so neighbours don't move in lockstep. Also picks a fixed character if no mascot is given. */
  id: string;
  mascot?: string;
  arg?: string | null;
  tint?: string;
  size?: CharSize;
}

const cache = new Map<string, string>();

// The mascot name and its option are set by an admin and stored in the database, then interpolated into SVG markup.
// So: only known mascot names, and an option that is a plain colour or word. Anything else is ignored.
const SAFE_ARG = /^[#A-Za-z0-9]{1,30}$/;

function markup(mascot: string, rawArg: string | null | undefined): string {
  const arg = rawArg && SAFE_ARG.test(rawArg) ? rawArg : undefined;
  const k = `${mascot}|${arg ?? ''}`;
  let s = cache.get(k);
  if (s === undefined) {
    if (mascot === 'person') {
      const p = arg && Object.hasOwn(PPL, arg) ? PPL[arg] : undefined;
      s = p ? person(p) : M.drop!();
    } else {
      s = (Object.hasOwn(M, mascot) ? M[mascot]! : M.drop!)(arg);
    }
    cache.set(k, s);
  }
  return s;
}

/**
 * An animated SVG character. Animation is CSS-only and switches off under
 * prefers-reduced-motion (see styles/app.css). Pure function: usable from server and client components.
 */
export function Character({ id, mascot, arg, tint, size = '' }: CharacterProps) {
  const fixed = mascot ? undefined : FIXED[id];
  const m = mascot ?? fixed?.mascot ?? 'drop';
  const a = mascot ? arg : fixed?.arg ?? arg;
  const t = tint ?? fixed?.tint ?? 'a';
  return (
    <span className={`art ${size} t-${t}`.replace(/\s+/g, ' ')}>
      <svg
        className="doll"
        viewBox="0 0 80 80"
        style={{ ['--d' as string]: `-${(hash(id) % 47) / 10}s` }}
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: markup(m, a) }}
      />
    </span>
  );
}

/** Convenience for catalogue items. */
export function TestArt({ t, size = '' }: { t: { id: string; mascot: string; mascotArg: string | null; tint: string }; size?: CharSize }) {
  return <Character id={t.id} mascot={t.mascot} arg={t.mascotArg} tint={t.tint} size={size} />;
}
