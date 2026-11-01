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
  const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  // the rest of her life has had its turn already today: a hobby, a wish, a gift, the plan
  Object.assign(soul, { at: Date.now(), energy: 10, boredom: 20, social: 60, joy: 60, next: 1, said: 0, cool: {}, packStates: null,
    morningDay: today, lateAt: Date.now(), activeSince: 0, hobby: { kind: "read", since: Date.now() }, wishAt: Date.now(), giftAt: Date.now(),
    planAskedDay: today, lastDay: today, firstDay: today });
  await soulTick({ fireTrigger: async (t, p) => fired.push([t, p]) });
  assert.deepEqual(fired[0], ["anim_play", { state: "yawning" }]);
  assert.equal(diaryToday().pastimes, 1);
});

test("the rest of her life: your programs, friendship levels, the voice for the mood, achievements", () => {
  const { appKindOf, friendship, voiceTrigger, ACHIEVEMENTS, lateHour, median } = internals;
  assert.equal(appKindOf("code"), "code");
  assert.equal(appKindOf("chrome"), "browser");
  assert.equal(appKindOf("discord"), "chat");
  assert.equal(appKindOf("blender"), "creative");
  assert.equal(appKindOf("notepad"), "");
  assert.equal(friendship(10, "ru").name, "знакомые");
  assert.equal(friendship(50, "ru").name, "близкие");
  assert.equal(friendship(95, "en").name, "kindred spirits");
  const s = { voiceMood: true, character: "cheerful" };
  assert.equal(voiceTrigger(s, "sleepy"), "anim_say_soft");
  assert.equal(voiceTrigger(s, "happy"), "anim_say_bright");
  assert.equal(voiceTrigger(s, "calm"), "anim_say");
  assert.equal(voiceTrigger({ ...s, voiceMood: false }, "sleepy"), "anim_say");
  const got = ACHIEVEMENTS.filter((a) => a.need({ days: 8, pats: 120, found: 0, lateNights: 1, workHours: 5, musicHours: 0, wishes: 0, goals: 0, bond: 25 })).map((a) => a.id);
  assert.deepEqual(got.sort(), ["days7", "friends", "night", "pats10", "pats100"]);
  // a late hour after midnight counts past 24, the usual is the middle one
  assert.equal(lateHour(new Date(2026, 0, 2, 1, 30)), 25.5);
  assert.equal(median([23, 25, 24]), 24);
});

test("greetings: a date first, then a late arrival against your usual hour", () => {
  const { greetingKey, soul } = internals;
  const s = { birthday: "05-17" };
  const at = (m, d, h) => new Date(2026, m - 1, d, h, 0).getTime();
  Object.assign(soul, { greetDay: "", arrivals: {}, firstDay: "" });
  assert.equal(greetingKey(s, "morning", at(12, 31, 10), "a", 10).key, "newYear");
  Object.assign(soul, { greetDay: "" });
  assert.equal(greetingKey(s, "morning", at(5, 17, 10), "b", 10).key, "birthday");
  // usually at 9: arriving at 12 she was waiting
  Object.assign(soul, { greetDay: "", arrivals: { d1: 9, d2: 9.2, d3: 8.8 } });
  assert.equal(greetingKey(s, "morning", at(6, 3, 12), "c", 12).key, "waited");
  Object.assign(soul, { greetDay: "", arrivals: { d1: 9, d2: 9.2, d3: 8.8 } });
  assert.equal(greetingKey(s, "morning", at(6, 4, 9), "d", 9).key, "morning");
  // a month since the first day
  Object.assign(soul, { greetDay: "", arrivals: {}, firstDay: "2026-03-10" });
  const g = greetingKey(s, "morning", at(4, 10, 10), "e", 10);
  assert.deepEqual([g.key, g.vars?.months], ["anniversaryMonth", 1]);
});

test("her pack's block: things in her hands, her holding poses, the sky of the hour — through the hub", () => {
  const { lifeBlock } = internals;
  const pack = ["[states.idle]", "[[states.idle.variants]]", 'clip = "breathe"', "[states.drag]", 'clip = "d"', "[states.as_sleep]", 'clip = "z"', "",
    "[effects.ambient]", 'kind = "emit"', "", "[interactions.none]", 'clip = "ambient"', ""].join("\n");
  const all = lifeBlock(pack, { props: true, sky: true }, 23);
  assert.deepEqual(all.names, ["cl_read", "cl_tea", "cl_hug", "cl_sky"]);
  assert.equal(all.hub, "ambient");
  assert.ok(all.rows.includes('[states.cl_tea]\nclip = "cl_hold"\nloop = true'));
  assert.ok(all.rows.includes('[[clips]]\nname = "cl_hug"\nfile = "clips/companion-life/hug.vrma"'));
  assert.ok(all.rows.includes('[effects.cl_read]\nkind = "contacts"\nprop = "cl_read"\npet_states = ["cl_read"]'));
  assert.ok(!all.rows.includes("look"));
  assert.ok(all.rows.includes('file = "clips/companion-life/star.png"'));
  assert.ok(/\[effects\.cl_sky\][^]*pet_states = \["idle", "cl_read", "cl_tea", "cl_hug", "as_sleep"\]/.test(all.rows));
  // morning: the engine's own sparkles; the afternoon: no sky
  assert.ok(lifeBlock(pack, { props: false, sky: true }, 8).rows.includes('file = "builtin:nayu-anims/sparkle.png"'));
  assert.deepEqual(lifeBlock(pack, { props: false, sky: true }, 14).names, []);
  // no hub: nothing
  assert.equal(lifeBlock(pack.replace("[interactions.none]", "[x]"), { props: true, sky: true }, 23).rows, "");
});

test("words: every situation of the second book in all three languages", () => {
  const { PHRASES } = internals;
  for (const key of ["hungry", "weatherSnow", "newYear", "app_code", "pomoBreak", "sulk", "dream", "wish_pat", "gift", "achievement", "levelUp", "water", "praised", "goalDone"]) {
    for (const lang of ["ru", "en", "ja"]) assert.ok(PHRASES[lang][key]?.any?.length, `${lang}:${key}`);
  }
  for (const key of Object.keys(PHRASES.ru)) assert.ok(PHRASES.ja[key]?.any?.length, `ja:${key}`);
});
