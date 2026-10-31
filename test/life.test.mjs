// Companion Life against a throwaway %APPDATA% — nothing here touches the real Astra config.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const appdata = fs.mkdtempSync(path.join(os.tmpdir(), "companion-life-"));
process.env.APPDATA = appdata; // read when the plugin module loads
fs.mkdirSync(path.join(appdata, "astra", "astra", "config", "logs"), { recursive: true });
fs.writeFileSync(path.join(appdata, "astra", "astra", "config", "logs", "daemon.log.test"), "");
const require = createRequire(import.meta.url);
const { internals } = require("./.build/plugin.cjs");

test("needs drift into a mood, and a pastime suits the mood, the hour and what she has", () => {
  const { moodOf, driftSoul, pickPastime, PASTIMES, SOUL_WORDS } = internals;
  const s = (o) => ({ energy: 80, boredom: 20, social: 60, joy: 60, ...o });
  assert.equal(moodOf(s({ energy: 20 }), 14), "sleepy");
  assert.equal(moodOf(s({ energy: 45 }), 1), "sleepy");
  assert.equal(moodOf(s({ social: 20 }), 14), "lonely");
  assert.equal(moodOf(s({ boredom: 80 }), 14), "bored");
  assert.equal(moodOf(s({ joy: 80 }), 14), "happy");
  assert.equal(moodOf(s(), 14), "calm");
  const a = driftSoul(s(), 30, { hour: 14, here: true });
  assert.ok(a.boredom > 20 && a.social > 60 && a.energy < 80);
  assert.ok(driftSoul(s(), 60, { hour: 14, away: true }).social < 40);
  const m = driftSoul(s({ boredom: 60 }), 10, { hour: 14, music: true, here: true });
  assert.ok(m.boredom < 60 && m.joy > 60);
  assert.ok(driftSoul(s({ energy: 30 }), 10, { hour: 2, asleep: true }).energy > 50);
  const have = new Set(["texting", "think", "hello", "sad", "eat", "yawn", "as_lively_hum", "as_peek"]);
  const c = { hour: 10, day: "d", here: true };
  const ids = new Set();
  for (let i = 0; i < 80; i++) ids.add(pickPastime("bored", c, have, {}, 0)?.id);
  assert.deepEqual([...ids].sort(), ["peek", "phone", "think"]);
  for (let i = 0; i < 30; i++) assert.notEqual(pickPastime("lonely", { ...c, here: false }, have, {}, 0).id, "call");
  assert.equal(pickPastime("calm", { ...c, hour: 12 }, have, {}, 0).id, "snack");
  assert.notEqual(pickPastime("calm", { ...c, hour: 12, snacks: ["d:1"] }, have, {}, 0)?.id, "snack");
  for (let i = 0; i < 30; i++) assert.notEqual(pickPastime("bored", c, have, { phone: 10 }, 0).id, "phone");
  // a nap only while you are away
  const sleepy = new Set(["yawn", "as_sleep"]);
  for (let i = 0; i < 30; i++) assert.notEqual(pickPastime("sleepy", c, sleepy, {}, 0).id, "nap");
  assert.ok([...Array(40)].some(() => pickPastime("sleepy", { ...c, here: false, away: true }, sleepy, {}, 0).id === "nap"));
  for (const p of PASTIMES.filter((x) => x.say)) assert.ok(SOUL_WORDS.ru[p.say]?.length && SOUL_WORDS.en[p.say]?.length, p.say);
});

test("free to do something: not on an edge, not at Astra's work, not while music plays", () => {
  const { standing } = internals;
  const now = 1_000_000_000;
  assert.equal(standing({ state: "idle", at: now - 5000, music: 0 }, now), true);
  assert.equal(standing({ state: "sit", at: 0, music: 0 }, now), false);
  assert.equal(standing({ state: "as_work_browser", at: 0, music: 0 }, now), false);
  assert.equal(standing({ state: "idle", at: 0, music: now - 30000 }, now), false);
  assert.equal(standing({ state: "dance_linger", at: now - 90000, music: 0 }, now), false);
});

test("a tick plays a pastime of her pack through the plugin's command", async () => {
  const { soul, soulTick } = internals;
  const pack = path.join(appdata, "astra", "astra", "config", "companion", "pack");
  fs.mkdirSync(path.join(pack, "characters", "her"), { recursive: true });
  fs.mkdirSync(path.join(pack, "animpacks", "her-anims"), { recursive: true });
  fs.writeFileSync(path.join(pack, "companion.toml"), 'character = "her"\n');
  fs.writeFileSync(path.join(pack, "characters", "her", "character.toml"), '[character]\nkind = "vrm"\nanimpack = "her-anims"\n');
  fs.writeFileSync(path.join(pack, "animpacks", "her-anims", "animpack.toml"), '[states.idle]\nclip = "a"\n[states.yawn]\nclip = "y"\n');
  const fired = [];
  Object.assign(soul, { at: Date.now(), energy: 10, boredom: 20, social: 60, joy: 60, next: 1, said: 0, cool: {}, packStates: null });
  await soulTick({ fireTrigger: async (t, p) => fired.push([t, p]) });
  assert.deepEqual(fired[0], ["anim_play", { state: "yawn" }]);
});
