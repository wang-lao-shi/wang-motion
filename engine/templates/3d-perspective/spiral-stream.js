import { base, P, backFade, easeOf, EASINGS, rotZ } from '../_common.js';
// A helix of curved cards winding down (or up) around an invisible column; the stream slides along the spiral.
export default {
  id: 'spiral-stream', name: 'Spiral Stream', category: '3d-perspective', slots: 24,
  desc: 'Cards streaming along a 3D helix, far side seen mirrored through the spiral',
  tags: ['spiral', 'helix', 'stream', '3d', 'vertical'], ref: 'animos',
  params: base({
    spiralTurns: P.num('Spiral turns', 3.75, 1, 8, '', 0.25),
    cardCount: P.num('Card count', 24, 6, 60),
    spiralSize: P.pct('Spiral size', 62, 20, 150),
    taper: P.pct('Taper', 0, -100, 100),
    cardSize: P.pct('Card size', 33, 5, 80),
    backFade: P.pct('Back fade', 55),
    perspective: P.perspective(20),
    ringTilt: P.deg('Ring tilt', 0, -60, 60),
    cardGap: P.pct('Card gap', 28),
    scalePulse: P.pct('Scale pulse', 0),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'downward', ['downward', 'upward']),
    motion: P.choice('Motion', 'continuous', ['continuous', 'fastSlowFast', 'stepPerCard']),
    cardRatio: P.cardRatio(),
    cardStyle: P.choice('Card style', 'curved', ['curved', 'upright']),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.2, rim: 0.7,
  duration: 28,
  camera(ctx) { return { perspective: ctx.p.perspective, y: 0.12, lookY: 0 }; },
  layout(ctx) {
    const { p, u, M } = ctx;
    const V = ctx.view;
    const N = Math.max(3, Math.round(p.cardCount));
    const perTurn = N / p.spiralTurns;
    const dth = M.TAU / perTurn;
    const R0 = (p.spiralSize / 100) * 0.368 * Math.min(V.w / 0.8, 1.25);
    const h = (p.cardSize / 100) * 0.7;
    const pitchTurn = h * 2.0;                  // vertical rise per turn
    const dy = pitchTurn / perTurn;
    // travel in cards
    const dir = p.direction === 'upward' ? -1 : 1;
    let s;
    const total = N * p.speed;
    if (p.motion === 'stepPerCard') { const x = u * total; const k = Math.floor(x); s = k + easeOf(p.ease)(Math.min(1, (x - k) / 0.55)); }
    else if (p.motion === 'fastSlowFast') s = total * (u - Math.sin(u * M.TAU) / (M.TAU) * 0.8);
    else s = u * total;
    s *= dir;
    const roll = M.rad(p.ringTilt);
    const incl = Math.atan2(dy, dth * R0);
    const pulse = p.scalePulse / 100;
    const out = [];
    for (let i = 0; i < N; i++) {
      const k = M.mod(i + s, N) - N / 2;          // position along the helix, 0 = centre
      const th = k * dth;
      const R = R0 * (1 + (p.taper / 100) * 0.5 * (-k / (N / 2)));
      let pos = [R * Math.sin(th), -k * dy, R * Math.cos(th)];
      pos = rotZ(pos, roll);
      const arc = dth * R * (1 - p.cardGap / 100 * 0.3);
      const sc = 1 + pulse * 0.3 * Math.cos(th);
      const facing = Math.cos(th);
      const edge = M.smooth(N / 2, N / 2 - 2, Math.abs(k));
      const curved = p.cardStyle !== 'upright';
      out.push({ media: i, x: pos[0], y: pos[1] + 0.04, z: pos[2], ry: curved ? th : 0, rz: roll, shear: curved ? -dy / (dth * R) : 0, order: 'YXZ',
        w: arc * sc, h: h * sc, bend: curved ? 1 / R : 0, bright: backFade(facing, p.backFade / 100), opacity: edge });
    }
    return out;
  },
};
