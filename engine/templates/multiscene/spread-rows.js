import { spreadParams, spreadLayout } from './_spread.js';
// A stack of cards fans out from depth into staggered rows that drift sideways, then gathers back into the stack.
export default {
  id: 'spread-rows', name: 'Spread Rows', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Card stack spreads out of depth into drifting rows, then gathers back',
  tags: ['multiscene', 'stack', 'rows', 'spread', 'grid', 'drift'], ref: 'animos',
  params: spreadParams('rows'),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.3,
  duration: 8,
  layout(ctx) { return spreadLayout(ctx, false); },
};
