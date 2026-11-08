import { base, P, EASINGS, easeOf, CARD_RATIO_OPTS } from '../_common.js';
// Image Trail (animos replica): an invisible cursor sweeps an arc across the frame and drops a card at its
// position at a steady rhythm (like a mouse image-trail effect). Cards pop in from a smaller scale, stay put,
// and are eaten from the tail end. Two strokes per loop; the second is the first rotated 180° about the centre.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
// stroke geometry (frame-height units, y up): arc around C with radius R, angle a0 + rate*tau
const C = [-0.132, -0.099], R = 0.474, A0 = 0.451, RATE = 8.6;
// ref cursor is uneven: tight drops near the tail, a burst of speed around the 9th/10th drop, ~steady after.
// warp(j) maps drop index (0..17) to path position in drop units; warp(0)=0, warp(17)=17.
let DEATH0 = 0.341, BUMP = 1.15, TAILK = 0;   // TAILK 0: the burst's lead is kept to the stroke end (ref end cards run further off-frame)
function warp(j) {
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const b = j <= 9.5 ? sm((j - 8) / 1) : 1 - TAILK * (j - 9.5) / 7.5;   // burst lands between the 9th and 10th drop
  return j + BUMP * b;
}
export default {
  id: 'image-trail', name: 'Image Trail', category: 'stack-scatter', slots: 12,
  desc: 'Cards drop along a sweeping cursor path like a mouse image trail, popping in and vanishing from the tail',
  tags: ['trail', 'cursor', 'scatter', 'pop', 'sweep', 'stack'], ref: 'animos',
  params: base({
    cornerRadius: P.cornerRadius(0),
    cardSize: P.num('Card size', 19, 5, 50, '%', 0.5),
    trailLength: P.num('Trail length', 18, 4, 40),
    popFrom: P.pct('Pop from', 50, 0, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: { type: 'choice', label: 'Card ratio', default: '1:1', options: CARD_RATIO_OPTS },
    shadow: P.bool('Shadow', true),
    arc: P.pct('Arc size', 100, 30, 150),
  }),
  shadow: true, shadowOpacity: 0.3,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, view } = ctx;
    const ease = easeOf(p.ease);
    const L = Math.max(2, Math.round(p.trailLength));
    const cr = ctx.spec?.cardRatio || p.cardRatio || '1:1';
    const r = cr === 'auto' ? ctx.ratioOf(0) : (RAT[cr] || 1);
    const base = (p.cardSize / 100) * Math.min(view.w, view.h);
    const w0 = r >= 1 ? base : base * r, h0 = w0 / r;
    // path scaled uniformly by the frame's smaller side (no per-axis stretch in 9:16 / 16:9), centred
    // portrait: pull the stroke in from the side edges and stretch it vertically so the two strokes use the tall frame
    const m = Math.min(view.w, view.h), por = view.w < view.h ? view.h / view.w : 1;
    const sx = m * (por > 1 ? 0.84 : 1), sy = m * (1 + (por - 1) * 0.7), k = p.arc / 100;
    // one card every 0.25/18 of the loop (stroke of 18 cards ≈ 2.5 s)
    const dt = 0.25 / 18;
    const out = [];
    for (let s = 0; s < 2; s++) {
      const sign = s ? -1 : 1;
      // evaluate this stroke at local time (two copies: current and previous loop for seamlessness)
      for (const off of [0, -1]) {
        const tau = u - s * 0.5 - off;      // time since stroke start
        if (tau < 0 || tau > 0.75) continue;
        for (let j = 0; j < L; j++) {
          const tj = j * dt;
          const age = tau - tj;
          if (age < -0.0067) continue;
          const death = DEATH0 + j * 0.0125 * (18 / L);   // tail is eaten faster than it grew
          const die = M.clamp((tau - (death - 0.05)) / 0.05, 0, 1);
          if (die >= 1) continue;
          const pf = p.popFrom / 100;
          const grow = ease(M.clamp((age - 0.012) / 0.035, 0, 1));
          let sc = pf + (1 - pf) * grow;
          sc *= 1 - ease(die);
          if (sc <= 0.002) continue;
          const op = M.clamp((age + 0.0067) / 0.0067, 0, 1);   // ~2-frame fade-in softens the pop-from-50% appearance
          const th = A0 + RATE * dt * warp(j * 17 / Math.max(1, L - 1)) * (L - 1) / 17;
          const lx = (C[0] + R * Math.cos(th)) * k, ly = (C[1] + R * Math.sin(th)) * k;
          const x = sign * lx * sx, y = sign * ly * sy;
          out.push({ media: M.mod(s * L + j, n), x, y, z: 0.0005 * j, w: w0 * sc, h: h0 * sc, opacity: op,
            layer: Math.round((s * 0.5 + off + tj) * 1e4) /* newest drop always on top */, shadow: p.shadow ? undefined : 0 });
        }
      }
    }
    return out;
  },
};
