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
  const { moodOf, driftSoul, pickPastime } = internals;
  const s = (o) => ({ energy: 80, boredom: 20, social: 60, joy: 60, bond: 10, ...o });
  assert.equal(moodOf(s({ energy: 20 }), 14), "sleepy");
  assert.equal(moodOf(s({ energy: 45 }), 1), "sleepy");
  assert.equal(moodOf(s({ social: 20 }), 14), "lonely");
  assert.equal(moodOf(s({ boredom: 80 }), 14), "bored");
  assert.equal(moodOf(s({ joy: 80 }), 14), "happy");
  assert.equal(moodOf(s(), 14), "calm");
  const a = driftSoul(s(), 30, { hour: 14, here: true });
  assert.ok(a.boredom > 20 && a.social > 60 && a.energy < 80 && a.bond > 10);
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
});

test("any pack: a pastime finds its state by similar names, never a state that is hers to be in", () => {
  const { stateFor, PASTIMES, pickPastime } = internals;
  const p = (id) => PASTIMES.find((x) => x.id === id);
  // exact names first, best first
  assert.equal(stateFor(p("call"), new Set(["wave", "hello"])), "hello");
  // a state that has the name as a whole part
  assert.equal(stateFor(p("call"), new Set(["as_mx_wave", "idle"])), "as_mx_wave");
  assert.equal(stateFor(p("phone"), new Set(["girl_phone_texting_loop"])), "girl_phone_texting_loop");
  // not inside another word, not a system state
  assert.equal(stateFor(p("spin"), new Set(["spinach"])), "");
  assert.equal(stateFor(p("call"), new Set(["dance_wave"])), "");
  // the picked pastime says which state it plays
  assert.equal(pickPastime("lonely", { hour: 10, here: true }, new Set(["as_mx_wave"]), {}, 0).use, "as_mx_wave");
});

test("character: weights her pastimes, and her words come from her own pool more often", () => {
  const { pickPastime, PERSONALITIES, phraseFor } = internals;
  const have = new Set(["texting", "think", "shy", "yawn", "stretch"]);
  const count = (pers, id, mood) => [...Array(400)].filter(() => pickPastime(mood, { hour: 10, here: true }, have, {}, 0, Math.random, pers).id === id).length;
  assert.ok(count(PERSONALITIES.shy, "shy", "calm") > count(PERSONALITIES.energetic, "shy", "calm"));
  assert.ok(count(PERSONALITIES.lazy, "phone", "bored") > count(PERSONALITIES.energetic, "phone", "bored"));
  // dice below 0.6: her character's pool
  assert.ok(phraseFor("ru", "pat", "tsundere", {}, () => 0.1).length > 0);
  const own = new Set([...Array(40)].map((_, i) => phraseFor("ru", "back", "tsundere", {}, () => (i % 10) / 10 * 0.59)));
  assert.ok([...own].every((t) => /Явился|Долго/.test(t)));
});

test("words: every situation has them in both languages, {name} filled or left out cleanly", () => {
  const { PHRASES, PASTIMES, phraseFor } = internals;
  for (const key of Object.keys(PHRASES.ru)) assert.ok(PHRASES.en[key]?.any?.length && PHRASES.ru[key].any.length, key);
  for (const p of PASTIMES.filter((x) => x.say)) assert.ok(PHRASES.ru[p.say], p.say);
  // dice: first her character's pool, then its last phrase ("Подпевай, {name}!")
  const dice = () => { const seq = [0.1, 0.99]; let i = 0; return () => seq[i++ % 2]; };
  assert.equal(phraseFor("ru", "hum", "cheerful", { name: "Даня" }, dice()), "Подпевай, Даня!");
  assert.equal(phraseFor("ru", "hum", "cheerful", { name: "" }, dice()), "Подпевай!");
  assert.ok(phraseFor("ru", "missed", "cheerful", { days: 3 }, () => 0.1).includes("3"));
  assert.ok(!/\{\w+\}/.test(phraseFor("ru", "diary", "shy", { work: "2 ч", pats: 3, naps: 1, music: "10 мин", games: 0 }, () => 0.1)));
});

test("attachment fades only after two days apart; quiet hours wrap past midnight", () => {
  const { bondAfterAbsence, quietNow } = internals;
  assert.equal(bondAfterAbsence(50, 1), 50);
  assert.equal(bondAfterAbsence(50, 5), 41);
  assert.equal(bondAfterAbsence(5, 30), 0);
  const s = { quiet: { on: true, from: 23, to: 8 }, calls: true };
  assert.equal(quietNow(s, 2), true);
  assert.equal(quietNow(s, 23), true);
  assert.equal(quietNow(s, 12), false);
  assert.equal(quietNow({ ...s, quiet: { on: false, from: 23, to: 8 } }, 2), false);
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

test("a tick plays a pastime of her pack through the plugin's command, and the day goes in her diary", async () => {
  const { soul, soulTick, diaryToday } = internals;
  const pack = path.join(appdata, "astra", "astra", "config", "companion", "pack");
  fs.mkdirSync(path.join(pack, "characters", "her"), { recursive: true });
  fs.mkdirSync(path.join(pack, "animpacks", "her-anims"), { recursive: true });
  fs.writeFileSync(path.join(pack, "companion.toml"), 'character = "her"\n');
  fs.writeFileSync(path.join(pack, "characters", "her", "character.toml"), '[character]\nkind = "vrm"\nanimpack = "her-anims"\n');
  fs.writeFileSync(path.join(pack, "animpacks", "her-anims", "animpack.toml"), '[states.idle]\nclip = "a"\n[states.yawning]\nclip = "y"\n');
  const fired = [];
  const day = new Date();
  Object.assign(soul, { at: Date.now(), energy: 10, boredom: 20, social: 60, joy: 60, next: 1, said: 0, cool: {}, packStates: null,
    morningDay: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`, lateAt: Date.now(), activeSince: 0 });
  await soulTick({ fireTrigger: async (t, p) => fired.push([t, p]) });
  assert.deepEqual(fired[0], ["anim_play", { state: "yawning" }]);
  assert.equal(diaryToday().pastimes, 1);
});
