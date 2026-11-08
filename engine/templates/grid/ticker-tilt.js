import { P, EASINGS, easeOf, cardAR } from '../_common.js';
import { tickerRows } from './ticker-loop.js';
const CARD_K = 0.87;     // card width per 100% zoom (frame-height units, ≤ 0.75 aspect scales down)
const CARD_AR = 1.03;    // default card aspect (w/h) when Card ratio = auto
const GAP_K = 1.1;       // row-gap % → world units
const COL_GAP_K = 0.105; // gap between cards along a row, × card width
const WALL_LIFT = 0.21;  // wall sits this many row pitches above the lattice centre (animos: top full row near the top edge)
// Wall of card rows tipped back in perspective (top recedes); alternate rows scroll opposite ways.
export default {
  id: 'ticker-tilt', name: 'Ticker Tilt', category: 'grid', slots: 12,
  desc: 'Card rows on a wall tipped back in perspective, rows scrolling opposite ways',
  tags: ['ticker', 'marquee', 'wall', 'perspective', 'rows', 'loop'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(3),
    zoom: P.pct('Zoom', 32, 10, 150),
    tilt: P.deg('Tilt', 30, -80, 80),
    perspective: P.pct('Perspective', 60, 0, 100),
    rowGap: P.pct('Row gap', 4, 0, 20),
    ease: P.choice('Easing', 'custom', EASINGS),
    flow: P.choice('Flow', 'opposed', ['opposed', 'same', 'staggered']),
    direction: P.choice('Direction', 'left', ['left', 'right']),
    cardRatio: P.cardRatio(),
    loopCards: P.num('Cards per loop', 12, 1, 24),
  },
  shadow: false, sheen: 0.08,
  duration: 12,
  camera(ctx) { return { perspective: ctx.p.perspective * 0.2 }; },
  layout(ctx) {
    const p = ctx.p;
    const k = CARD_K, gk = GAP_K;
    const w = (p.zoom / 100) * k * Math.min(1, ctx.view.w / 0.75), py = w / cardAR(ctx, CARD_AR) + (p.rowGap / 100) * gk;
    // animos: the top full row runs LEFT for direction=left, rows alternate below it
    return tickerRows(ctx, { k, ar: CARD_AR, gk, gxk: COL_GAP_K, y: WALL_LIFT * py, period: Math.round(p.loopCards), rx: p.tilt, reach: 1.5, flow: p.flow, reverse: p.direction !== 'right', ease: easeOf(p.ease) });
  },
};
