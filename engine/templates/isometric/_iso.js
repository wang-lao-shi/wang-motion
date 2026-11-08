// shared isometric helpers (near-orthographic camera + iso orientation)
import { mRx, mRy, mMul, mApply, eulerYXZ } from '../_common.js';
// orientation matrix: yaw b around Y then pitch a around X (applied as Rx(a)·Ry(b))
export function isoMat(pitch, yaw) { return mMul(mRx(pitch), mRy(yaw)); }
export function isoEuler(m) { return eulerYXZ(m); }
export { mApply, mMul, mRx, mRy };
// near-orthographic camera: tiny fov, far away
export const isoCamera = () => ({ fov: 1.2 });
// one iso card + a dark "thickness" plate peeking out under it (white lit lower edge), like animos iso cards.
// R: orientation matrix, e: its euler, local: [x,y,z] position in the oriented frame (z toward viewer).
export function isoCard(R, e, local, w, h, extra = {}, slab = true) {
  const pos = mApply(R, local);
  const rot = { rx: e.rx, ry: e.ry, rz: e.rz, order: e.order };
  const th = w * 0.045;
  const out = [];
  if (slab) {
    const sp = mApply(R, [local[0], local[1] - th, local[2] - th * 1.5 - 0.004]);
    out.push({ ...extra, color: '#0a0a0d', useMedia: false, x: sp[0], y: sp[1], z: sp[2], ...rot, w, h, rim: 1, edgeBottom: 0.9, edgeW: th * 0.28, shadow: 0, sheen: 0 });
  }
  out.push({ ...extra, x: pos[0], y: pos[1], z: pos[2], ...rot, w, h, edgeTop: 0.85, edgeW: th * 0.25 });
  return out;
}
