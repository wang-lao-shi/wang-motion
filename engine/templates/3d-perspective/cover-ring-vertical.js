import { base, P, EASINGS } from '../_common.js';
import { ring } from './cover-ring.js';
// Large ring of cards around the viewer's focus; steps one card per beat, front card centred, far side seen mirrored.
export default {
  id: 'cover-ring-vertical', name: 'Cover Ring Vertical', category: '3d-perspective', slots: 8,
  desc: 'Big vertical ring of covers rolling one card per beat',
  tags: ['ring', 'carousel', 'cover', '3d', 'step', 'vertical'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 37, 5, 100),
    ringSize: P.pct('Ring size', 131, 30, 300),
    rotate: P.deg('Rotate', 0, -180, 180),
    tilt: P.deg('Tilt', 0, -60, 60),
    perspective: P.perspective(55),
    backFade: P.pct('Back fade', 55),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'bottomToTop', ['bottomToTop', 'topToBottom']),
    motion: P.choice('Motion', 'stepPerCard', ['stepPerCard', 'continuous']),
    ringCount: P.num('Cards in ring', 8, 3, 24),
  }),
  shadow: false, sheen: 0.2, rim: 0.85, edgeX: 0, edgeTop: 0.75, edgeW: 0.004,
  duration: 14,
  camera(ctx) { return { fov: 6 + ctx.p.perspective * 0.42 }; },
  layout(ctx) { return ring(ctx, true); },
};

