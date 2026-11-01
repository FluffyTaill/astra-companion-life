// Companion Life against a throwaway %APPDATA% — nothing here touches the real Astra config.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const appdata = fs.mkdtempSync(path.join(os.tmpdir(), "companion-life-"));
process.env.APPDATA = appdata; // read when the plugin module loads
process.env.COMPANION_LIFE_DOCS = path.join(appdata, "docs"); // her backups and cards, not the real Documents
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
  // she eats by herself only when very hungry, or hungry while you are away long; feeding her is yours
  assert.notEqual(pickPastime("calm", { ...c, hour: 12, hunger: 60 }, have, {}, 0)?.id, "snack");
  assert.equal(pickPastime("calm", { ...c, hour: 12, hunger: 90 }, have, {}, 0).id, "snack");
  assert.equal(pickPastime("calm", { ...c, here: false, away: true, hunger: 65 }, have, {}, 0).id, "snack");
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

test("her personality: traits drive her, her manner shapes her words, Astra's personality seeds it, a card carries it to the chat", () => {
  const { cleanPersona, persFrom, styleText, callName, reactionGroup, personaFromPrompt, characterCard, chronoOf } = internals;
  // a character is a starting point; out-of-range values are held in range
  const p = cleanPersona({ traits: { energy: 140, shy: -5 }, tics: "ня, ~", ticRate: 100, calls: { happy: "Данечка" } }, "shy");
  assert.deepEqual([p.traits.energy, p.traits.shy, p.traits.talk], [100, 0, 30]);
  assert.deepEqual(p.tics, ["ня", "~"]);
  // shy and lazy vs bold and lively
  const quiet = persFrom(cleanPersona({ traits: { shy: 90, energy: 10, talk: 10 } }));
  const loud = persFrom(cleanPersona({ traits: { shy: 10, energy: 90, talk: 90 } }));
  assert.ok(quiet.weights.shy > loud.weights.shy && quiet.weights.nap > loud.weights.nap && loud.weights.spin > quiet.weights.spin);
  assert.ok(loud.talk > quiet.talk && quiet.drift.energy > loud.drift.energy);
  // loves and dislikes
  const liked = persFrom(cleanPersona({ likes: { hum: 1, phone: -1 } }));
  assert.ok(liked.weights.hum > 2 && liked.weights.phone < 0.2);
  // impatient and mischievous sulks sooner
  assert.ok(persFrom(cleanPersona({ traits: { mischief: 90, patience: 10 } })).sulkAfter < persFrom(cleanPersona({ traits: { mischief: 10, patience: 90 } })).sulkAfter);
  // an owl is sleepy in the morning, a lark at night
  assert.equal(chronoOf("owl", 7).night, true);
  assert.equal(chronoOf("owl", 1).night, false);
  assert.equal(chronoOf("lark", 22).night, true);
  // her manner: a word at the end, an emoji, a short phrase; what she calls you in this mood
  assert.equal(styleText("Привет! Я тут.", p, "happy", () => 0), "Привет! Я тут, ня.");
  assert.equal(styleText("Привет, Даня. Как дела?", cleanPersona({ short: true }), "calm", () => 0.99), "Привет, Даня.");
  assert.equal(callName(p, "happy", "Даня"), "Данечка");
  assert.equal(callName(p, "calm", "Даня"), "Даня");
  assert.deepEqual([reactionGroup("pat"), reactionGroup("gameJealous"), reactionGroup("lateDeep"), reactionGroup("hum")], ["pat", "game", "late", ""]);
  // Astra's personality: its words move the traits, its text is her story, her name is read from it
  const a = personaFromPrompt("You are Astra. Your character: energetic, caring and shy. Use emoji.", "cheerful");
  assert.equal(a.herName, "Astra");
  assert.ok(a.traits.energy > 65 && a.traits.affection > 75 && a.traits.shy > 25 && a.emoji);
  assert.ok(a.story.startsWith("You are Astra"));
  // the card: Character Card V2, her name, her character and manner in the system prompt, the mood tool
  const card = characterCard(cleanPersona({ ...a, tics: ["ня"] }), { name: "Даня", lang: "ru" });
  assert.equal(card.spec, "chara_card_v2");
  assert.equal(card.data.name, "Astra");
  assert.ok(/companion_mood/.test(card.data.system_prompt) && /ня/.test(card.data.system_prompt) && /Даня/.test(card.data.system_prompt));
  assert.ok(card.data.system_prompt.includes("You are Astra. Your character"));
});

test("feeding her: less hungry and happier, more for what she loves, refused when full, a sweet at night wakes her; a starter set fills only what her pack lacks", async () => {
  const { cleanPersona, starterPlan, soul } = internals;
  const { feedSoul, FOODS, foodTaste, STARTER } = await import("./.build/care.cjs");
  const p = cleanPersona({ loves: "клубника, тортики", dislikes: "рамен" });
  assert.equal(foodTaste("strawberry", p), 1);
  assert.equal(foodTaste("cake", p), 1);
  assert.equal(foodTaste("ramen", p), -1);
  assert.equal(foodTaste("tea", p), 0);
  const s = { hunger: 70, joy: 50, bond: 30, energy: 40 };
  const r = feedSoul(s, "onigiri", p, 13);
  assert.ok(r.ok && r.key === "fed" && s.hunger === 25 && s.joy === 58);
  assert.equal(feedSoul({ ...s, hunger: 60 }, "strawberry", p, 13).key, "fedLove");
  assert.equal(feedSoul({ ...s, hunger: 60 }, "ramen", p, 13).key, "fedDislike");
  const night = { ...s, hunger: 60 };
  assert.equal(feedSoul(night, "candy", p, 23).key, "fedNight");
  assert.equal(night.energy, 55);
  assert.deepEqual(feedSoul({ ...s, hunger: 5 }, "cake", p, 13), { ok: false, key: "full" });
  assert.equal(Object.keys(FOODS).length >= 8, true);
  // the starter set: only for pastimes her pack has nothing for, and only when switched on
  const pack = ["[states.idle]", "[states.eat]", "[states.texting]", "[states.hello]"].join("\n");
  assert.deepEqual(starterPlan(pack, { starter: false }), []);
  const plan = starterPlan(pack, { starter: true }).map((e) => e.state);
  assert.ok(!plan.includes("cl_eat") && !plan.includes("cl_texting") && !plan.includes("cl_hello"));
  // without the download only Astra's own clips are there
  assert.deepEqual(plan, STARTER.filter((e) => e.builtin).map((e) => e.state));
});

test("backups: a copy of her settings and memories in her Documents folder, brought back after a reinstall", () => {
  const { backupNow, listBackups, restoreBackup, soul } = internals;
  const settings = path.join(appdata, "astra", "astra", "config", "companion-life", "settings.json");
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, JSON.stringify({ name: "Даня", character: "shy" }));
  soul.bond = 63;
  soul.totals.fed = 7;
  const file = backupNow();
  assert.ok(file.startsWith(path.join(appdata, "docs", "backups")));
  assert.equal(listBackups()[0].file, file);
  // the app reinstalled: settings and memories gone
  fs.writeFileSync(settings, JSON.stringify({ name: "" }));
  soul.bond = 10;
  soul.totals.fed = 0;
  restoreBackup(file);
  assert.equal(JSON.parse(fs.readFileSync(settings, "utf8")).name, "Даня");
  assert.equal(soul.bond, 63);
  assert.equal(soul.totals.fed, 7);
  assert.throws(() => restoreBackup(settings));
});

test("the slower life: attachment on a daily budget, a shop, health, chat games, a weekly letter, the month and year", async () => {
  const M = await import("./.build/more.cjs");
  // one day of everything cannot give more than the day's budget, and closer means slower
  const s = { bond: 10 };
  for (let i = 0; i < 100; i++) M.gainBondOn(s, 1, "d1");
  const budget = M.BOND_DAY * (1 - 10 / 110);
  assert.ok(s.bond - 10 <= budget + 1e-9 && s.bond - 10 > 0.9 * budget);
  const close = { bond: 80 };
  for (let i = 0; i < 100; i++) M.gainBondOn(close, 1, "d1");
  assert.ok(close.bond - 80 < 1);
  // from new to soul mates takes weeks of good days, not an afternoon
  const b = { bond: 10 };
  let days = 0;
  while (b.bond < 90 && days < 400) M.gainBondOn(b, 99, `d${++days}`);
  assert.ok(days > 45 && days < 120, `${days} days`);
  // the shop: locked by level, then by coins
  assert.equal(M.canBuy(M.PRESENTS.necklace, 1, 999), "locked");
  assert.equal(M.canBuy(M.PRESENTS.flower, 0, 3), "coins");
  assert.equal(M.canBuy(M.PRESENTS.flower, 0, 30), "");
  // health: hunger and no rest wear her down, sleep brings her back
  const h = { health: 50, hunger: 95, energy: 10 };
  M.healthDrift(h, 60, false);
  assert.ok(h.health < 50 && M.sick({ health: 39 }) && !M.sick({ health: 40 }));
  assert.ok(M.healthDrift({ health: 50, hunger: 20, energy: 60 }, 60, true) > 50);
  // rock-paper-scissors in any of her languages
  assert.deepEqual(M.rps("камень", () => 0.5), { you: "rock", her: "paper", result: "her" });
  assert.equal(M.rps("ножницы", () => 0.5).result, "you");
  assert.equal(M.rps("hello"), null);
  // guess the number: higher / lower, three tries
  let g = M.guess(null, NaN, 0, () => 0.55).game;
  assert.equal(g.secret, 6);
  assert.equal(M.guess(g, 3, 1).answer, "higher");
  g = M.guess(g, 3, 1).game;
  assert.equal(M.guess(g, 6, 2).answer, "right");
  // the weekly letter and the month
  const week = [{ day: "2026-11-01", work: 300, pats: 4, fed: 2, music: 60, played: 1 }, { day: "2026-11-02", work: 100, pats: 9, fed: 0, music: 0, played: 3 }];
  const letter = M.weekLetter(week, { lang: "ru", name: "Даня", her: "Астра", level: "друзья" });
  assert.ok(letter.startsWith("Даня,") && /13 раз/.test(letter) && /2026-11-02/.test(letter) && letter.endsWith("— Астра 💌"));
  const months = M.foldDay({}, "2026-10-20", { work: 120, pats: 3, fed: 1 });
  const t = M.statsFor("2026-10", months, { "2026-10-30": { work: 60, pats: 2 }, "2026-11-01": { work: 500 } });
  assert.deepEqual([t.work, t.pats, t.fed, t.days], [180, 5, 1, 2]);
  assert.equal(M.statsFor("2026", months, {}).pats, 3);
});
