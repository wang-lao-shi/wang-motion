import { base, P, cardAR, easeOf, EASINGS, latticeMedia, mRx, mRz, mMul, mApply, eulerYXZ } from '../_common.js';
// Full-bleed lattice of big cards in rows, the whole wall slightly rotated; neighbouring rows scroll in opposite directions.
export function tickerRows(ctx, o) {
  const { p, n, u, M, view: V } = ctx;
  const ar = cardAR(ctx, o.ar);
  const w = (p.zoom / 100) * o.k * Math.min(1, V.w / 0.75), h = w / ar;
  const gx = w * (o.gxk ?? 0.075), gy = (p.rowGap / 100) * o.gk;
  const px = w + gx, py = h + gy;
  const K = o.period;                                  // cards each row travels per loop
  const tiltZ = M.rad(o.rz || 0), tiltX = M.rad(o.rx || 0);
  const G = mMul(mRx(-tiltX), mRz(tiltZ));
  const reach = Math.hypot(V.w, V.h) * 0.5 * (o.reach || 1);
  const R = Math.ceil(reach / py) + 1, C = Math.ceil(reach / px) + 2;
  const out = [];
  for (let r = -R; r <= R; r++) {
    let dir = o.flow === 'same' ? 1 : (M.mod(r, 2) ? -1 : 1);
    if (o.reverse) dir = -dir;
    let s;
    if (o.flow === 'staggered') { const x = u * K + (M.mod(r, 2) ? 0.5 : 0); const k = Math.floor(x); s = (k + o.ease(Math.min(1, (x - k) / 0.5))) * dir; }
    else if (o.motion === 'zoomPulse' || o.motion === 'zoomWaypoints') s = (o.motion === 'zoomWaypoints' ? (() => { const x = u * 4; const k = Math.floor(x); return (k + o.ease(Math.min(1, (x - k) / 0.6))) * K / 4; })() : u * K) * dir;
    else s = u * K * dir;
    const base0 = Math.floor(s);
    for (let c = -C; c <= C; c++) {
      const j = c + base0;                           // lattice column index (media)
      const X = (j - s) * px + (o.rowShift || 0) * r * px;
      const Y = -r * py;
      const q = mApply(G, [X, Y, 0]);
      out.push({ media: latticeMedia(j, r, n, K, 3), x: q[0], y: q[1] + (o.y || 0), z: q[2], ...eulerYXZ(G), w, h });
    }
  }
  return out;
}
export default {
  id: 'ticker-loop', name: 'Ticker Loop', category: 'grid', slots: 12,
  desc: 'Full-bleed wall of big cards, slightly rotated, rows scrolling in opposite directions',
  tags: ['ticker', 'marquee', 'wall', 'rows', 'loop', 'full-bleed'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(3),
    zoom: P.pct('Zoom', 45, 10, 150),
    tilt: P.deg('Tilt', -6, -45, 45),
    rowGap: P.pct('Row gap', 4, 0, 20),
    movement: P.choice('Movement', 'continuous', ['continuous', 'zoomPulse', 'zoomWaypoints']),
    orientation: P.choice('Orientation', 'horizontal', ['horizontal', 'vertical']),
    direction: P.choice('Direction', 'opposed', ['opposed', 'sameWay']),
    cardRatio: P.cardRatio(),
    ease: P.choice('Easing', 'custom', EASINGS),
    loopCards: P.num('Cards per loop', 12, 1, 24),
  },
  shadow: true, shadowOpacity: 0.35, sheen: 0.08,
  duration: 12,
  layout(ctx) {
    const p = ctx.p;
    const vert = p.orientation === 'vertical';
    const cards = tickerRows(ctx, { k: 0.91 * (ctx.view.h > ctx.view.w * 1.2 ? 0.7 : 1), ar: 1.035, gk: 0.9, period: Math.round(p.loopCards), rz: -p.tilt + (vert ? 90 : 0), flow: p.direction === 'sameWay' ? 'same' : 'opposed', reverse: true, motion: p.movement, ease: easeOf(p.ease) });
    if (vert) cards.forEach((c) => { c.rz = (c.rz || 0) - Math.PI / 2; });
    if (p.movement === 'zoomPulse' || p.movement === 'zoomWaypoints') {
      const z = 1 - 0.22 * (0.5 - 0.5 * Math.cos(ctx.u * Math.PI * 2 * 2));
      cards.forEach((c) => { c.x *= z; c.y *= z; c.w *= z; c.h *= z; });
    }
    return cards;
  },
};
