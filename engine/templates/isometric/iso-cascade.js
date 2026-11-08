import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
import { beats } from '../../lib.js';
import { isoMat, isoEuler, mApply, isoCamera } from './_iso.js';
// Isometric stack of upright cards marching diagonally across the frame, nearest card at the top-right.
export default {
  id: 'iso-cascade', name: 'Iso Cascade', category: 'isometric', slots: 8,
  desc: 'Isometric diagonal stack of cards sliding toward the viewer, one card per beat',
  tags: ['isometric', 'stack', 'diagonal', 'cascade', 'product'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 42, 10, 100),
    tilt: P.pct('Tilt', 70),
    spacing: P.pct('Spacing', 40, 5, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'stepped']),
    direction: P.choice('Direction', 'up-right', ['up-right', 'down-left', 'down-right', 'up-left']),
    cardsPerLoop: P.num('Cards per loop', 10, 1, 24),
  }),
  shadow: true, shadowOpacity: 0.12, sheen: 0,
  duration: 10,
  camera: isoCamera,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const dir = p.direction;
    const mirror = dir === 'down-right' || dir === 'up-left';
    const back = dir === 'down-left' || dir === 'up-left';
    const pitch = -M.rad(p.tilt * 0.5);
    const yaw = M.rad(52) * (mirror ? -1 : 1);   // steeper top-edge slope (≈0.73 on screen) like animos
    const R = isoMat(pitch, yaw);
    const e = isoEuler(R);
    const N = Math.max(1, Math.round(p.cardsPerLoop));
    const k0 = p.motion === 'stepped' ? beats(u, N, 0.45, easeOf(p.ease)) : u * N;
    const prog = back ? -k0 : k0;
    const sc = Math.sqrt(Math.min(1, ctx.aspect));
    const W = (p.cardSize / 100) * sc / Math.cos(yaw);
    const H = W / cardAR(ctx, 1.43);      // auto: landscape face (matches animos face height)
    // stack runs on screen along a diagonal through the frame centre: the nearest card is at the
    // lower-left, the stack recedes up-right (mirror: up-left). Spacing is a screen-space step.
    const step = (p.spacing / 100) * 0.43 * sc;
    const dx = 0.83 * (mirror ? -1 : 1), dy = 0.56;
    const out = [];
    const span = Math.ceil(1.6 / step) + 2;
    const th = W * 0.012;
    const rot = { rx: e.rx, ry: e.ry, rz: e.rz, order: e.order };
    // card centre offset so the visible bands straddle the frame centre
    const cx = 0.17 * (mirror ? -1 : 1), cy = 0.11;
    for (let j = -span; j <= span; j++) {
      const s = j - 0.2 + M.fract(prog);                // screen steps along the diagonal (+ = further / up-right)
      const idx = j + 1 - Math.floor(prog);
      const media = (((idx % N) + N) % N) % n;
      const x = cx + s * step * dx, y = cy + s * step * dy, z = s * step * 0.6;   // up-right card is nearest (covers the upper part of the one behind)
      if (!ctx.p.noSlab) {
        const sp = mApply(R, [0, -th * 0.6, -th]);
        out.push({ media, color: '#0a0a0d', useMedia: false, x: x + sp[0], y: y + sp[1], z: z + sp[2], ...rot, w: W, h: H, shadow: 0, layer: 0 });
      }
      out.push({ media, x, y, z, ...rot, w: W, h: H, zoom: 1.1, edgeTop: 0.9, edgeW: W * 0.008 });   // zoom crops the media's inset frame lines
    }
    return out;
  },
};
