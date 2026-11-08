import { base, P, EASINGS } from '../_common.js';
import { strip } from './_strip.js';
// Horizontal film strip of cards wrapped on a cylinder, scrolling left through the centre
export default {
  id: 'film-strip', name: 'Film Strip', category: 'carousel-flow', slots: 6,
  desc: 'Horizontal film strip of cards wrapped on a cylinder, scrolling left through the centre',
  tags: ['carousel', 'strip', 'cylinder', '3d', 'loop'], ref: 'animos',
  params: base({
    cornerRadius: P.cornerRadius(3),
    cardSize: P.pct('Card size', 32, 5, 100),
    gap: P.pct('Gap', 2.5, 0, 30),
    curve: P.pct('3D curve (out / in)', 70, -100, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'stopAtCenter']),
    loopCards: P.num('Cards per loop', 6, 2, 24),
    perspective: P.perspective(30),
  }),
  shadow: false, sheen: 0.08,
  duration: 12,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) { return strip(ctx, false); },
};
