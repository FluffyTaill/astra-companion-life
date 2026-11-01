// Her poses for holding things: both forearms forward, palms toward each other, fingers a little
// cupped, the arms away from her body so the thing has room in front of her.
//
//   (cd ../astra-anim-studio && npm run pretest) && node tools/gen_hold.cjs <standing.vrma> assets
//
// Uses Anim Studio's VRMA helpers (the sibling repo). Rotations are degrees on top of the standing
// pose, in the bone's own T-pose axes: a left arm swings forward with −y and out with +z, a left
// elbow bends with −y; the right side mirrors (+y, −z); fingers curl with −z (left) / +z (right).
const fs = require("fs"), path = require("path"), Module = require("module");
const load = Module._load;
Module._load = function (r, ...a) {
  if (r === "astra-plugin-sdk") return { plugin: (x) => ({ ...x, run() {} }), tool: (x) => x, s: new Proxy({}, { get: () => () => ({}) }) };
  return load.call(this, r, ...a);
};
const { internals: I } = require(path.join(__dirname, "..", "..", "astra-anim-studio", "test", ".build", "plugin.cjs"));
const FPS = 30;

// the first frame of a clip, held for `dur` seconds
function holdPose(buf, dur) {
  const { json, bin } = I.readGlb(buf);
  const anim = json.animations[0];
  const frames = [];
  for (let i = 0; i <= Math.round(dur * FPS); i++) frames.push(i / FPS);
  const out = { ...json, accessors: [], bufferViews: [] };
  const glb = I.glbAdder(out, Buffer.alloc(0));
  const input = glb.add(frames, "SCALAR", true);
  const samplers = [], channels = [];
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    let vals = I.readAccessor(json, bin, s.output);
    if (s.interpolation === "CUBICSPLINE") vals = vals.filter((_, k) => k % 3 === 1);
    const v0 = vals[0];
    samplers.push({ input, output: glb.add(frames.map(() => v0), v0.length === 4 ? "VEC4" : "VEC3"), interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: ch.target });
  }
  out.animations = [{ name: "pose", samplers, channels }];
  delete out.buffers;
  return I.writeGlb(out, glb.bin());
}

function wobble(dur, period, amp, axis, base = [0, 0, 0], phase = 0) {
  const out = [];
  for (let t = 0; t <= dur + 1e-6; t += 1 / FPS) {
    const v = [...base];
    v[axis] += amp * Math.sin((t / period) * 2 * Math.PI + phase);
    out.push([Math.round(t * 1000) / 1000, ...v]);
  }
  return out;
}
const still = (v) => [[0, ...v]];
const curl = (side, [p, i, d]) => {
  const s = side === "left" ? -1 : 1, keys = {};
  for (const f of ["Index", "Middle", "Ring", "Little"]) {
    keys[`${side}${f}Proximal`] = still([0, 0, s * p]);
    keys[`${side}${f}Intermediate`] = still([0, 0, s * i]);
    keys[`${side}${f}Distal`] = still([0, 0, s * d]);
  }
  keys[`${side}ThumbProximal`] = still([0, s * 15, s * 10]);
  return keys;
};

// [upper arm forward, out], elbow, hand turn in, finger curl; the whole loop breathes
const POSES = {
  hold: { upper: [-25, 40], elbow: 70, hand: 0, curl: [30, 35, 20] },
  hug: { upper: [-20, 34], elbow: 80, hand: 10, curl: [20, 25, 15] }
};
const DUR = 4;

const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
for (const [name, p] of Object.entries(POSES)) {
  const base = holdPose(fs.readFileSync(src), DUR);
  const [fwd, side] = p.upper;
  const bones = {
    chest: wobble(DUR, 4, 1.2, 0),
    leftUpperArm: wobble(DUR, 4, 1.5, 1, [0, fwd, side]),
    rightUpperArm: wobble(DUR, 4, 1.5, 1, [0, -fwd, -side], Math.PI),
    leftLowerArm: still([0, -p.elbow, 0]),
    rightLowerArm: still([0, p.elbow, 0]),
    leftHand: still([0, -p.hand, 0]),
    rightHand: still([0, p.hand, 0]),
    ...curl("left", p.curl),
    ...curl("right", p.curl)
  };
  const buf = I.vrmaEdit(base, { bones });
  fs.writeFileSync(path.join(out, `${name}.vrma`), buf);
  console.log(`${name}.vrma`, buf.length, "bytes");
}
