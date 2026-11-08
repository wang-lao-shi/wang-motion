import { base, P, cardAR } from '../_common.js';
// Flat, camera-facing cards travelling around a wide horizontal ellipse; front cards large & bright, back cards small & dim.
export function orbitPhase(u, n, motion, k = 0.6) {
  if (motion !== 'fastSlowFast') return u;
  return u - (k * Math.sin(Math.PI * 2 * n * u)) / (Math.PI * 2 * n); // slows when a card reaches the front
}
export default {
  id: 'orbit-showcase', name: 'Orbit Showcase', category: 'orbit', slots: 12,
  desc: 'Camera-facing cards orbiting a wide flat ellipse, the front card popping forward',
  tags: ['orbit', 'ring', 'carousel', 'ellipse', 'hero'], ref: 'animos',
  params: base({
    pulseStrength: P.pct('Pulse strength', 60),
    ringWidth: P.pct('Ring width', 64, 10, 150),
    ringDepth: P.pct('Ring depth', 26, 0, 100),
    ringTilt: P.deg('Ring tilt', 0, -90, 90),
    spread: P.pct('Spread', 100, 10, 100),
    cardSize: P.pct('Card size', 22, 5, 60),
    perspective: P.perspective(55),
    backFade: P.pct('Back fade', 45),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    motion: P.choice('Motion', 'linear', ['linear', 'fastSlowFast']),
    cardRatio: P.cardRatio(),
    speed: P.speed(1),
  }),
  shadow: true, shadowOpacity: 0.5, rim: 0.85, edgeTop: 0.35, edgeW: 0.003,
  duration: 12,
  layout(ctx) { return ring(ctx, { sMul: 0.95, scPow: 0.8, fadeOpacity: true }); },
};
// shared ellipse ring: opts.lean (cards lean toward centre), opts.curve (card bend)
export function ring(ctx, o) {
  const { p, n, u, M } = ctx;
  const dir = p.direction === 'counterClockwise' ? -1 : 1;
  const ph = orbitPhase(u * (p.speed ?? 1), n, p.motion);
  const sc = Math.pow(Math.min(1, ctx.aspect), o.scPow ?? 1) * (o.sMul ?? 1);
  const Rx = (p.ringWidth / 100) * 0.45 * sc * (o.wMul ?? 1);
  const Ry = (p.ringDepth / 100) * 0.5 * 0.85 * (o.dMul ?? 1) * (o.sMul ?? 1);
  const Rz = Math.max(Ry, 0.02) * (o.zMul ?? 0.9);
  const tilt = M.rad(p.ringTilt);
  const ar = cardAR(ctx, o.ar ?? 0.92);
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = (M.TAU * i / n) * (p.spread ?? 100) / 100 + dir * M.TAU * ph;
    const c = Math.cos(th), s = Math.sin(th);
    let x = Rx * s, y = -Ry * c + (o.y0 ?? 0.02), z = Rz * c;
    const xr = x * Math.cos(tilt) - (y - (o.y0 ?? 0.02)) * Math.sin(tilt);
    const yr = x * Math.sin(tilt) + (y - (o.y0 ?? 0.02)) * Math.cos(tilt) + (o.y0 ?? 0.02);
    const front = Math.pow(Math.max(0, c), 10);
    const pulse = 1 + (p.pulseStrength / 100) * 0.16 * front;
    const w = (p.cardSize / 100) * 0.88 * sc * pulse;
    const fade = (p.backFade / 100) * (1 - c) * 0.5;
    // fadeOpacity: back cards become see-through (lower opacity) and only a little darker (animos Orbit Showcase)
    const bright = o.fadeOpacity ? 1 - fade * 0.45 : 1 - fade * 1.1;
    const card = { media: i, x: xr, y: yr, z: z + front * 0.02, w, h: w / ar, bright, rz: o.roll ? tilt : 0 };
    if (o.fadeOpacity) card.opacity = 1 - fade * 1.1;
    if (o.lean) card.ry = -o.lean * s;
    if (o.curve) card.bend = o.curve / Math.max(Rx, 0.05);
    out.push(card);
  }
  return out;
}
