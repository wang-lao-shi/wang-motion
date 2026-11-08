import { base, P } from '../_common.js';
// Square tunnel lined with cards on floor, ceiling and both walls; the camera glides forward through it.
export default {
  id: 'card-tunnel', name: 'Card Tunnel', category: '3d-perspective', slots: 8,
  desc: 'Fly-through square tunnel whose four walls are paved with cards',
  tags: ['tunnel', 'fly-through', 'depth', '3d', 'immersive'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(1.5),
    tunnelSize: P.pct('Tunnel size', 90, 30, 200),
    cardLength: P.pct('Card length', 55, 10, 150),
    gap: P.pct('Gap', 10, 0, 60),
    depthFade: P.pct('Depth fade', 45),
    direction: P.choice('Direction', 'forward', ['forward', 'backward']),
    period: P.num('Cards per loop', 8, 2, 24),
    speed: P.speed(1),
  },
  shadow: false, sheen: 0.12, edgeW: 0.004, depthWrite: true,
  duration: 20,
  camera() { return { perspective: 36 }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const V = ctx.view;
    const ax = (p.tunnelSize / 100) * 0.5 * Math.max(V.w, 0.6), ay = (p.tunnelSize / 100) * 0.5;
    const L = (p.cardLength / 100) * 0.68;
    const per = Math.max(1, Math.round(p.period));
    const Mslots = per * Math.max(2, Math.ceil(16 / per));
    const dir = p.direction === 'backward' ? -1 : 1;
    const s = u * per * p.speed * dir;
    const zNear = ctx.camDist - (ctx.camDist * 0.25 + L * 0.5) * 1.3 * Math.max(1, V.w) ** 0.4 + L * 0.5;   // visible slots start ~30% further out
    const cl = L * (1 - p.gap / 100);
    const out = [];
    // wall: [name, mediaOffset]
    const walls = [['floor', 0], ['ceil', 5], ['left', 6], ['right', 4]];
    walls.forEach(([wn, off], wi) => {
      for (let j = 0; j < Mslots; j++) {
        const d = M.mod(j - s, Mslots);
        const z = zNear - (d + 0.5) * L;
        const media = ((((j + off) % per) + per * wi) % n + n) % n;
        const vis = 4 + 9 * (1 - p.depthFade / 100);          // slots until black
        const bright = 1 - Math.min(1, (p.depthFade / 100) * 2.2) * M.smooth(0.5, vis, d);
        const op = M.smooth(vis + 2, vis, d) * M.smooth(Mslots, Mslots - 1.5, d) * M.smooth(0, 0.9 * Math.max(1, V.w) ** 0.5, d);   // nearest slot fades as it leaves
        const c = { media, z, bright: Math.max(0.05, bright), opacity: op };
        if (wn === 'floor') Object.assign(c, { x: 0, y: -ay, rx: -Math.PI / 2, w: ax * 2 * 0.88, h: cl, edgeX: 0.9 });
        if (wn === 'ceil') Object.assign(c, { x: 0, y: ay, rx: Math.PI / 2, w: ax * 2 * 0.88, h: cl, edgeX: 0.9 });
        if (wn === 'left') Object.assign(c, { x: -ax, y: 0, ry: Math.PI / 2, w: cl, h: ay * 2 * 0.88, edgeTop: 0.9, edgeBottom: 0.9 });
        if (wn === 'right') Object.assign(c, { x: ax, y: 0, ry: -Math.PI / 2, w: cl, h: ay * 2 * 0.88, edgeTop: 0.9, edgeBottom: 0.9 });
        out.push(c);
      }
    });
    return out;
  },
};
