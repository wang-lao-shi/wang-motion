import { base, P, EASINGS, easeOf, cardAR, mRy, mApply } from '../_common.js';
// Dense ring of overlapping cards: one quick full spin zoomed out, then the camera dives onto the top of the ring
// and the ring clicks round through spin stops before pulling back out.
function zoomIn(ctx) {
  const { u, M } = ctx; const ez = easeOf(ctx.p.ease);
  return ez(M.win(u, 0.25, 0.37)) * (1 - ez(M.win(u, 0.885, 1)));
}
export default {
  id: 'focus-orbit', name: 'Focus Orbit', category: 'orbit', slots: 24,
  desc: 'Dense card ring that spins, then zooms onto its top and turns in stops',
  tags: ['orbit', 'ring', 'zoom', 'focus', 'stepped', 'portfolio'], ref: 'animos',
  params: base({
    pulseStrength: P.pct('Pulse strength', 60),
    zoom: P.num('Zoom', 2.4, 1, 5, '', 0.1),
    spinStops: P.num('Spin stops', 5, 2, 12),
    ringSize: P.pct('Ring size', 72, 20, 150),
    rotateY: P.deg('Rotate Y', 0, -80, 80),
    perspective: P.perspective(55),
    cardSize: P.pct('Card size', 18, 5, 50),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    motion: P.choice('Motion', 'smooth', ['smooth', 'fastSlowFast']),
    zoomStyle: P.choice('Zoom style', 'overlap', ['overlap', 'spotlight']),
    rotateYScope: P.choice('Rotate Y scope', 'always', ['always', 'zoomOnly']),
    cards: P.choice('Cards', 'faceFront', ['faceFront', 'followRotation']),
    cardRatio: P.cardRatio(),
    ringCards: P.num('Cards on ring', 24, 6, 48),
  }),
  shadow: true, shadowOpacity: 0.45, rim: 0.9, edgeTop: 0.6, edgeW: 0.003,
  duration: 12,
  camera(ctx) { const zin = zoomIn(ctx); return { perspective: ctx.p.perspective * (0.15 + 0.3 * zin) }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const ez = easeOf(p.ease);
    const S = Math.max(2, Math.round(p.spinStops));
    const K = Math.max(6, Math.round(p.ringCards));
    const dir = p.direction === 'counterClockwise' ? -1 : 1;
    // timeline (animos): [0,.22] one full turn zoomed out; [.25,.37] dive onto the top of the ring; [.375,.48] it swings
    // half a turn; landings at .5 .. .875 (S-1 landings, the remaining half turn split in stops); [.885,1] pull back out.
    const spinEase = p.motion === 'fastSlowFast' ? ((x) => x + Math.sin(M.TAU * x) * 0.12) : (x) => x;
    const L = S - 1, l0 = 0.5, l1 = 0.875;
    let rot = ez(M.win(u, 0, 0.22)) + 0.5 * ez(M.win(u, 0.375, l0 - 0.02));
    let settle = 0;
    if (L >= 2) {
      const sw = (l1 - l0) / (L - 1);
      for (let j = 1; j < L; j++) {
        const st = l0 + (j - 1) * sw;                         // move happens right after a landing
        rot += (0.5 / (L - 1)) * spinEase(ez(M.win(u, st + sw * 0.25, st + sw * 0.85)));
      }
      if (u >= l0 - 0.03 && u <= l1 + 0.03) { const x = M.fract((u - l0 + sw * 0.15) / sw); settle = Math.sin(Math.PI * M.clamp(x / 0.35, 0, 1)); }
    } else rot += 0.5 * ez(M.win(u, 0.55, 0.85));
    const zin = zoomIn(ctx);
    const Z = 1 + (p.zoom - 1) * zin;
    const sc = Math.min(1, ctx.aspect);
    const R0 = (p.ringSize / 100) * 0.5 * 0.88 * sc;
    // zoomed in, the ring opens up (cards stop overlapping): neighbours overlap by about half a card
    const R = R0 * (1 + 0.15 * zin);
    const w0 = (p.cardSize / 100) * 0.97 * sc, ar = cardAR(ctx, 1.05);
    const ryAmt = M.rad(p.rotateY) * (p.rotateYScope === 'zoomOnly' ? zin : 1);
    // ring plane tilt about X: zoomed out the bottom of the ring leans toward the viewer (flattened ellipse);
    // zoomed in the ring faces the camera, its arc stretched so it falls away steeply out of frame.
    const tl = M.rad(-3 * (1 - zin));
    const yS = 1 + 0.7 * zin;   // zoomed: the ring arc steepens, neighbours drop away on both sides of the focus card
    const ct = Math.cos(tl), stl = Math.sin(tl);
    const yTarget = 0.02 * zin;
    // painter order: higher index draws over lower (animos); zoomed in, the seam sits opposite the focused card
    const topIdx = Math.round(-K * dir * rot);
    const key = (i) => zin > 0.5 ? M.mod(i - topIdx + K / 2, K) : (i + Math.round(K * 0.4)) % K;
    const out = [];
    for (let i = 0; i < K; i++) {
      const a = M.TAU * (i / K + dir * rot);
      const ca = Math.cos(a);
      // pivot about the top of the ring when zoomed (top card stays put, the ring swings back under it)
      const yy = R * ca - R * zin;
      let pos = [R * Math.sin(a), yy * ct * yS + R * zin, yy * stl];
      pos = mApply(mRy(ryAmt), pos);
      const top = Math.max(0, ca);
      const s = 1 + (p.pulseStrength / 100) * 0.15 * settle * Math.pow(top, 40) * zin;
      let op = 1;
      if (p.zoomStyle === 'spotlight') { const f = Math.pow(top, 6); op = 1 - zin * 0.85 * (1 - f); }
      const card = {
        media: i % n, x: pos[0] * Z, y: (pos[1] - R * zin) * Z + yTarget, z: pos[2] * Z + key(i) * 0.0008,
        w: w0 * Z * s * (1 + 0.002 * zin), h: (w0 / ar) * Z * s * (1 + 0.002 * zin), ry: ryAmt, bright: op < 1 ? 0.4 + 0.6 * op : 1,
      };
      if (zin > 0.5) card.layer = key(i);   // engine sorts by camera distance; force index order when zoomed
      if (p.cards === 'followRotation') card.rz = -a;
      // cards that swing close to / behind the camera are dropped
      if (card.z > ctx.camDist * 0.6) continue;
      if (card.z > ctx.camDist * 0.4) card.opacity = (ctx.camDist * 0.6 - card.z) / (ctx.camDist * 0.2);
      out.push(card);
    }
    return out;
  },
};
