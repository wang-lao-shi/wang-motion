import { base, P, cardAR } from '../_common.js';
// Cards fanned around the centre at increasing depth; the whole stack scrolls toward (or away from) the camera.
export default {
  id: 'depth-stack-scroll', name: 'Depth Stack Scroll', category: '3d-perspective', slots: 24,
  desc: 'Fly-through of cards fanned in depth, each passing the camera in turn',
  tags: ['depth', 'fly-through', 'stack', 'z-scroll', '3d'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(3),
    cardSize: P.pct('Card size', 25, 5, 80),
    cardCount: P.num('Card count', 24, 6, 60),
    depthGap: P.pct('Depth gap', 32, 5, 100),
    spread: P.pct('Spread', 74, 0, 150),
    wobble: P.pct('Wobble', 0),
    depthFade: P.pct('Depth fade', 45),
    depthBlur: P.num('Depth blur', 0, 0, 100, '%', 0.5),
    layout: P.choice('Layout', 'fan', ['fan', 'scatter']),
    direction: P.choice('Direction', 'forward', ['forward', 'backward']),
    cardRatio: P.cardRatio(),
    speed: P.speed(1),
  },
  shadow: true, shadowOpacity: 0.4, sheen: 0.5, rim: 0.1, edgeBottom: 0.9, edgeW: 0.003,
  duration: 14,
  camera() { return { perspective: 22 }; },
  layout(ctx) {
    const { p, u, M } = ctx;
    const V = ctx.view;
    const N = Math.max(3, Math.round(p.cardCount));
    const gap = (p.depthGap / 100) * 1.7 / Math.sqrt(N / 24);
    const dir = p.direction === 'backward' ? -1 : 1;
    const s = u * N * p.speed * dir - 0.33;   // phase offset: at default settings the nearest visible card is ~93px in a 260px frame (animos)
    const D = ctx.camDist, Dn = 0.25;              // nearest slot sits just in front of the camera (off-frame)
    const C = 0.25 * D;  // lateral offset ∝ (dist+C): cards drift outward as they approach (big ones leave past the edges), mid ones stay spread over the frame
    const ar = cardAR(ctx, 1.05);
    const out = [];
    for (let i = 0; i < N; i++) {
      const d = M.mod(i - s, N);                   // 0 = nearest (passing the camera)
      const dist = Dn + d * gap;                   // distance from camera
      const z = D - dist;
      // (sx, sy) = where the card sits on SCREEN while far away, in half-frame units -> far cards cover the whole frame to all four edges
      let sx, sy;
      if (p.layout === 'scatter') {
        sx = M.rand(i, 1) * 2 - 1; sy = M.rand(i, 2) * 2 - 1;
      } else {                                      // fan: low-discrepancy R2 sequence, evenly spread over the frame (incl. edges)
        sx = M.fract(0.31 + i * 0.3774388331 + (M.rand(i, 9) - 0.5) * 0.12) * 2 - 1;
        sy = M.fract(0.67 + i * 0.2849201455 + (M.rand(i, 8) - 0.5) * 0.12) * 2 - 1;
      }
      const sp = (p.spread / 100) / 0.74 * 1.02;    // 74% -> far cards reach the frame edges
      // world offset grows with (dist+C) -> screen position = far position at distance Df, flying outward as the card nears the camera
      const Df = Dn + N * gap * 0.6;
      const k = (dist + C) / (Df + C) * Df / D;
      const x = sx * sp * V.w * 0.5 * k;
      const y = sy * sp * V.h * 0.5 * k;
      const w = (p.cardSize / 100) * 1.04 * Math.min(1, Math.max(V.w, 0.7));
      const h = w / ar;
      const wob = (p.wobble / 100) * 0.35;
      const fadeIn = M.smooth(N, N - 3, d) * M.smooth(0.62, 0.7, dist * 0.26 * Math.min(1, V.w) / Math.max(0.05, w));   // animos: cards vanish once ~40% of frame, never fill it
      const dark = 1 - (p.depthFade / 100) * 1.0 * M.smooth(0.8, N * 0.6, d);
      out.push({ media: i, x, y, z, w, h,
        rz: wob * Math.sin(M.TAU * u * 2 + i), ry: wob * 0.6 * Math.sin(M.TAU * u + i * 1.7),
        opacity: fadeIn, edgeBottom: 0.9 * M.smooth(0.4, 1.6, d), bright: Math.max(0.05, dark), blur: (p.depthBlur / 100) * 5 * M.smooth(2, N * 0.6, d) });
    }
    return out;
  },
};
