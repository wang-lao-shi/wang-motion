import { base, P, cardAR, mRx, mRy, mMul, mApply, eulerYXZ } from '../_common.js';
import { isoCamera } from './_iso.js';
// 3x3 grid of cards lying on an isometric floor, swinging (or spinning) about the vertical axis while each card floats.
export default {
  id: 'iso-orbit', name: 'Iso Orbit', category: 'isometric', slots: 9,
  desc: 'Isometric floor grid of cards swinging around its centre, each card gently floating',
  tags: ['isometric', 'grid', 'floor', 'swing', 'float', 'product'], ref: 'animos',
  params: base({
    zoom: P.pct('Zoom', 85, 20, 200),
    spacing: P.pct('Spacing', 18, 0, 100),
    tilt: P.pct('Tilt', 55),
    swingAngle: P.deg('Swing angle', 30, 0, 90),
    float: P.num('Float', 2.5, 0, 10, '%', 0.5),
    motion: P.choice('Motion', 'swing', ['swing', 'fullSpin']),
    cardRatio: P.cardRatio(),
    gridSize: P.num('Grid size', 3, 2, 6),
  }),
  shadow: true, shadowOpacity: 0.35, rim: 0.7, sheen: 0.1,
  duration: 10,
  camera: isoCamera,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    // animos: the floor pitches up (more top-down) toward the swing ends (~+7° at 30° swing)
    const sw = Math.sin(M.TAU * u);
    const elev = M.rad(p.tilt * 0.54 + (p.motion === 'fullSpin' ? 0 : 7 * (p.swingAngle / 30) * sw * sw));
    const yaw = -M.rad(45) + (p.motion === 'fullSpin' ? M.TAU * u : -M.rad(p.swingAngle) * 0.95 * Math.sin(M.TAU * u));
    const V = mMul(mRx(elev), mRy(yaw));
    const C = mMul(V, mRx(-Math.PI / 2));
    const e = eulerYXZ(C);
    const G = Math.max(2, Math.round(p.gridSize));
    const sc = (p.zoom / 85) * Math.min(1, ctx.aspect) * (3 / G);
    const W = 0.16 * sc, H = W / cardAR(ctx, 1.12);
    const step = W * (1 + p.spacing / 100 * 1.2);   // animos gaps ≈20% of card width
    const th = W * 0.04;   // plate thickness (dark slab under each card)
    const out = [];
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      const i = r * G + c;
      const fy = (p.float / 100) * 1.0 * sc * Math.sin(M.TAU * (u + M.rand(i, 7)));   // one bob per loop
      const pos = mApply(V, [(c - (G - 1) / 2) * step, fy, (r - (G - 1) / 2) * step]);
      const rot = { rx: e.rx, ry: e.ry, rz: e.rz, order: e.order };
      const lx = (c - (G - 1) / 2) * step, lz = (r - (G - 1) / 2) * step;
      for (let q = 1; q <= 3; q++) {   // stacked dark slices give the card a visible thickness
        const sp = mApply(V, [lx, fy - th * q / 3, lz]);
        out.push({ media: i % n, color: '#0b0b0f', useMedia: false, x: sp[0], y: sp[1] + 0.02, z: sp[2] - 1e-4 * q, ...rot, w: W, h: H, shadow: q === 3 ? undefined : 0, rim: 0, sheen: 0, edgeBottom: q === 3 ? 0.5 : 0 });
      }
      out.push({ media: i % n, x: pos[0], y: pos[1] + 0.02, z: pos[2], ...rot, w: W, h: H });
    }
    return out;
  },
};
