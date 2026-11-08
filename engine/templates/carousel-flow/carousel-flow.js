import { base, P, EASINGS, easeOf, CARD_RATIO_OPTS } from '../_common.js';
// Full-frame slide carousel: the current card fills the frame, neighbours wait off-frame at a smaller scale;
// every beat the strip slides one card and the incoming card scales up to full size.
export default {
  id: 'carousel-flow', name: 'Carousel Flow', category: 'carousel-flow', slots: 12,
  desc: 'Full-frame slider: one card per beat slides in and scales up from a smaller side card',
  tags: ['carousel', 'slider', 'slideshow', 'step', 'fullscreen'], ref: 'animos',
  params: base({
    sideScale: P.num('Side card scale', 0.82, 0.3, 1, '', 0.01),
    gap: P.pct('Gap', 5, 0, 40),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'horizontal', ['horizontal', 'vertical']),
    cardRatio: { type: 'choice', label: 'Card ratio', default: 'frame', options: ['frame', ...CARD_RATIO_OPTS] },
    shadow: P.bool('Shadow', true),
    hold: P.pct('Hold', 50, 0, 90),
    loopCards: P.num('Cards per loop', 12, 2, 24),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const vert = p.direction === 'vertical';
    const K = Math.max(2, Math.round(p.loopCards));
    const cr = ctx.spec?.cardRatio || p.cardRatio || 'frame';
    let w = I.w, h = I.h;
    if (cr !== 'frame' && cr !== 'auto') { const r = ctx.ratioOf(0); if (r > I.w / I.h) h = I.w / r; else w = I.h * r; }
    if (cr === 'auto') { const r = ctx.ratioOf(0); if (r > I.w / I.h) h = I.w / r; else w = I.h * r; }
    const mv = 1 - Math.min(0.9, p.hold / 100);
    const x = u * K; const k0 = Math.floor(x);
    const s = k0 + easeOf(p.ease)(Math.min(1, (x - k0) / mv));
    const L = vert ? h : w; const ss = p.sideScale; const gap = p.gap / 100;
    const pitch = Math.max(L * (1 + ss) / 2 + gap, (vert ? ctx.view.h : ctx.view.w) / 2 + L * ss / 2 + 0.01);
    const out = [];
    for (let j = Math.floor(s) - 2; j <= Math.floor(s) + 3; j++) {
      const k = j - s; const a = Math.min(1, Math.abs(k));
      const sc = 1 - (1 - ss) * a;
      const off = Math.sign(k) * (a * pitch + Math.max(0, Math.abs(k) - 1) * (L * ss + gap));
      out.push({ media: M.mod(M.mod(j, K), n), x: vert ? 0 : off, y: vert ? -off : 0, z: -a * 0.01, w: w * sc, h: h * sc, layer: -Math.abs(k), bright: 1 - 0.25 * a });
    }
    return out;
  },
};
