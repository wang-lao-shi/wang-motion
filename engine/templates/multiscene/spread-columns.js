import { spreadParams, spreadLayout } from './_spread.js';
// A stack of cards fans out from depth into staggered columns that drift vertically, then gathers back into the stack.
export default {
  id: 'spread-columns', name: 'Spread Columns', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Card stack spreads out of depth into drifting columns, then gathers back',
  tags: ['multiscene', 'stack', 'columns', 'spread', 'grid', 'drift'], ref: 'animos',
  params: spreadParams('columns'),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.3,
  duration: 8,
  layout(ctx) { return spreadLayout(ctx, true); },
};
