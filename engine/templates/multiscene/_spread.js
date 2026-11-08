// shared engine for Spread Rows / Spread Columns: a stack of cards spreads (from depth) into rows (or columns)
// that drift, then gathers back into the stack.
import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';

const FAN = 0.75;          // gather fan width vs the line layout (animos gather fan is ~3/4 of the spread-out fan)
const HERO_X = 0.038;      // columns: the hero card sits slightly right of centre while the stack gathers
const DRIFT_STOP = [0.6, 0.75]; // drift eases out over this u window and holds (animos nearly stops between f5 and f6)
// drift phase: linear through the spread, eased out (zero slope) across DRIFT_STOP, then held
function driftPhase(u) {
  const [a, b] = DRIFT_STOP, d = b - a;
  if (u <= a) return u - 0.5;
  const x = Math.min(u, b) - a;
  return (a - 0.5) + x - x * x / (2 * d);
}

export function spreadParams(word) {
  const W = word === 'rows' ? 'Row' : 'Column';
  return base({
    [word]: P.num(word === 'rows' ? 'Rows' : 'Columns', 3, 1, 7),
    [word === 'rows' ? 'rowGap' : 'columnGap']: P.num(`${W} gap`, 3, 0, 20, '%', 0.25),
    cardGap: P.num('Card gap', 3, 0, 20, '%', 0.25),
    stackSize: P.pct('Stack size', 50, 10, 100),
    cameraZoom: P.pct('Camera zoom', 50, 0, 100),
    drift: P.pct('Drift', 16, 0, 100),
    [word === 'rows' ? 'rowDelay' : 'columnDelay']: P.pct(`${W} delay`, 4, 0, 30),
    ease: P.choice('Easing', 'custom', EASINGS),
    stackStyle: P.choice('Stack style', 'single', ['single', 'edges']),
    cardRatio: P.cardRatio(),
  });
}

export function spreadLayout(ctx, vertical) {
  const { p, n, M, u } = ctx;
  const ez = easeOf(p.ease);
  const ar = cardAR(ctx, 1.05);
  // rows on a tall frame: more rows (3 → 4 on 9:16) so the spread fills the height
  const tall = vertical ? 1 : Math.min(2, Math.max(1, 1 / ctx.aspect)) ** 0.6;
  const L = Math.max(1, Math.round((vertical ? p.columns : p.rows) * tall));
  const lineGap = (vertical ? p.columnGap : p.rowGap) / 100, cardGap = p.cardGap / 100;
  const delay = (vertical ? p.columnDelay : p.rowDelay) / 100;
  // card size: lines fill the cross axis, zoom enlarges
  const cross = vertical ? ctx.inner.w : Math.min(ctx.inner.h, ctx.inner.w * tall); // rows: min side (portrait, widened by the extra rows)
  const zoom = 0.8 + 0.18 * (p.cameraZoom / 50);
  let cw = (cross - lineGap * (L - 1)) / L * zoom; let ch = cw / ar;
  if (vertical) { /* columns: width across */ } else { ch = cw; cw = ch * ar; } // rows: height across
  const pl = (vertical ? cw : ch) + lineGap; // line pitch
  const pa = (vertical ? ch : cw) + cardGap; // pitch along the line
  const along = vertical ? ctx.view.h : ctx.view.w;
  const K = Math.ceil(along / pa / 2) + 1; // cards each side
  const sw = (p.stackSize / 50) * 0.38 * Math.min(1, ctx.view.w);
  const TG0 = 0.715; // spread start, per-card duration, gather start
  const out = [];
  const mid = (L - 1) / 2;
  for (let l = 0; l < L; l++) for (let c = -K; c <= K; c++) {
    const lr = l - mid;
    const order = Math.abs(c) / K; // outer cards travel later
    const dl = Math.abs(lr) * delay * 1.5;
    const cl = (x) => M.clamp(x, 0, 1);
    const sA = ez(cl((u - 0.015 - order * 0.02) / 0.1)) * (1 - ez(cl((u - 0.845 + order * 0.02) / 0.13)));
    const sB = ez(cl((u - 0.075 - dl - order * 0.03) / 0.13)) * (1 - ez(cl((u - TG0 + 0.02 - (delay * 1.5 * (mid - Math.abs(lr))) - (1 - order) * 0.03) / 0.13)));
    const s = sB;
    const dir = l % 2 ? 1 : -1;
    const drift = dir * (p.drift / 16) * 2.6 * pa * driftPhase(u);
    let a = c * pa + drift * sB + (Math.abs(Math.round(lr)) % 2 ? pa * 0.3 : 0), b = -lr * pl; // along, across
    // stack point
    let sa = 0, sb = 0;
    if (p.stackStyle === 'edges' && l % 2) sa = (c < 0 ? -1 : 1) * along * 0.42;
    // gather fan is narrower (FAN) than the spread fan; lines are fully spread at u=.5 so the switch is invisible
    // columns: lines interleave in the stack, so the fan shows many thin strips instead of a few thick cards
    const as = (vertical ? (c * L + lr) * pa / L : a) * (u > 0.5 ? FAN : 1), ord = vertical ? Math.abs(c * L + lr) / (K * L) : order;
    const A = sa + (as + (a - as) * s - sa) * sA, B = sb + (b - sb) * sB;
    const depth = (1 - s) * (0.15 + 2.4 * ord * sA + 0.2 * Math.abs(lr));
    const kd = cl((u - 0.8) / 0.15), dip = 1 - 0.3 * Math.sin(Math.PI * kd) ** 2; // shrink before restart
    const w = (sw + ((vertical ? cw : ch * ar) - sw) * s) * dip;
    const stackRank = vertical ? Math.abs(c * L + lr) : Math.abs(c) * L + Math.abs(lr);
    const media = ((((Math.round(lr) * 4 + c * 5 + 11) % n) + n) % n);
    const top = c === 0 && l === Math.round(mid);
    const hx = vertical && top && u > 0.5 ? HERO_X * (1 - s) * sA : 0;
    out.push({ media, x: (vertical ? B : A) + hx, y: vertical ? -A : B, z: top ? 0.01 * (1 - s) : -depth - stackRank * 0.002, w, h: w / ar,
      opacity: 1, bright: 1 - 0.25 * (1 - s) * Math.min(1, ord * 2) });
  }
  return out;
}
export { E };
