import { P, EASINGS } from '../_common.js';
import { wheel, wheelParams } from './wheel-spin.js';
// A big wheel whose hub sits below the frame: only its top arc of radial cards shows, rolling past like a dial.
export default {
  id: 'wheel-spin-bottom', name: 'Wheel Spin Bottom', category: 'orbit', slots: 8,
  desc: 'Top arc of a large card wheel rising from the bottom edge, rotating like a dial',
  tags: ['orbit', 'wheel', 'dial', 'arc', 'radial', 'lower-third'], ref: 'animos',
  params: wheelParams(20, 50, { ease: P.choice('Easing', 'custom', EASINGS) }, 16),
  shadow: false, rim: 0.85, edgeTop: 0.5, edgeW: 0.0022, depthWrite: true,
  duration: 14,
  camera() { return { perspective: 10 }; },
  layout(ctx) { return wheel(ctx, { bottom: true, rMul: 4.28, cardMul: 0.98, tilt: 0 }); },
};
