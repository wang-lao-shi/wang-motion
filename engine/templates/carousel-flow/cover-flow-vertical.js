import { base, P, EASINGS } from '../_common.js';
import { coverFlow } from './cover-flow.js';
// Vertical cover flow: flat centre card, neighbours tipped back above and below, one card per beat.
export default {
  id: 'cover-flow-vertical', name: 'Cover Flow Vertical', category: 'carousel-flow', slots: 5,
  desc: 'Vertical cover flow: centre cover flat, neighbours tipped above and below',
  tags: ['carousel', 'coverflow', 'vertical', 'step', 'product'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 46, 10, 100),
    gap: P.pct('Gap', 4, 0, 30),
    sideTilt: P.deg('Side tilt', 40, 0, 89),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'bottomToTop', ['bottomToTop', 'topToBottom']),
    motion: P.choice('Motion', 'stopAtCenter', ['stopAtCenter', 'continuous']),
    loopCards: P.num('Cards per loop', 5, 2, 24),
    perspective: P.perspective(30),
  }),
  shadow: false, sheen: 0.1,
  duration: 12,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) { return coverFlow(ctx, true); },
};
