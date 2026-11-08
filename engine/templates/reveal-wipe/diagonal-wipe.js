import { base, P, easeOf, EASINGS, CARD_RATIO_OPTS } from '../_common.js';
import { frameCard, frameRadiusMul } from './_frame.js';
// K steps per loop; each step holds image j, then the next image is revealed over the current one by a straight, slanted wipe edge with a soft white glow leading it.
export default {
  id: 'diagonal-wipe', name: 'Diagonal Wipe', category: 'reveal-wipe', slots: 12,
  desc: 'slideshow where each new image wipes in over the last along a slanted edge with a white glow',
  tags: ['reveal', 'wipe', 'slideshow', 'transition', 'diagonal'], ref: 'animos',
  params: base({
    edgeAngle: P.deg('Edge angle', -20, -60, 60),
    edgeGlow: P.pct('Edge glow', 60),
    ease: P.choice('Easing', 'custom', EASINGS),
    period: P.num('Cards per loop', 12, 2, 24),
    wipe: P.num('Wipe time', 45, 10, 100, '%'),
    direction: P.choice('Direction', 'right', ['right', 'left']),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
  }),
  shadow: true, shadowOpacity: 0.3, sheen: 0, rim: 0,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(2, Math.round(p.period));
    const ez = easeOf(p.ease);
    const { w, h } = frameCard(ctx);
    const md = (j) => M.mod(M.mod(j, K), n);
    const s = u * K, j = Math.floor(s) % K, f = s - Math.floor(s);
    const wt = p.wipe / 100;
    const k = ez(M.clamp((f - (1 - wt)) / wt)); // wipe occupies the last `wipe` of each step (ref: f0/f4/f6 show the step's own image)
    // world-space edge normal: tilted edgeAngle from vertical; convert to card-uv angle so the edge stays true at any aspect
    const phi = M.rad(p.edgeAngle) + (p.direction === 'left' ? Math.PI : 0);
    const ang = Math.atan2(h * Math.sin(phi), w * Math.cos(phi));
    const out = [{ media: md(j), x: 0, y: 0, z: 0, w, h, layer: 0 }];
    if (k > 0 && k < 1) {
      const g = p.edgeGlow / 100, lead = 0.035, glowW = 0.03;
      const pk = k * (1 + lead + glowW); // overshoot so the glow fully exits at k=1
      if (g > 0) out.push({ useMedia: false, color: '#fff', x: 0, y: 0, z: 0, w, h, layer: 1, shadow: 0, opacity: g * Math.min(1, (1 - k) * 8),
        mask: { type: 'line', angle: ang, p: pk, soft: glowW } });
      out.push({ media: md(j + 1), x: 0, y: 0, z: 0, w, h, layer: 2, shadow: 0, mask: { type: 'line', angle: ang, p: pk - lead, soft: 0.003 } });
    } else if (k >= 1) out[0].media = md(j + 1);
    const rm = frameRadiusMul(ctx, w, h); out.forEach((c) => (c.radiusMul = rm));
    return out;
  },
};
