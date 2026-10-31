// @ts-nocheck — plain JavaScript in a .ts file: esbuild bundles it, nothing here is type-checked.
// Companion Life — Astra plugin: the avatar lives a life of her own between the things that happen.
//
// Four needs drift with time and with what happens (energy, boredom, sociability, joy); from them a
// mood; for the mood, the hour, her character and what you are doing she finds herself something to
// do every few minutes — states of her own animation pack, cued through an Astra command this
// plugin's page creates — and now and then says a word about it in Astra's voice. She grows attached
// to you day by day, keeps a diary of your days together, plays hide-and-seek and catch-the-heart
// with your pointer, notices long typing, late nights and game sessions, and keeps quiet in quiet
// hours and while your microphone is in a call. What happens is read from two places only: the time
// since the last input, the foreground process, the pointer and whether a microphone is in use (a
// small PowerShell watcher — never the keys themselves), and the avatar engine's lines in Astra's log.
import * as import_node_fs from "node:fs";
import * as import_node_path from "node:path";
import * as import_node_child_process from "node:child_process";
import { plugin } from "astra-plugin-sdk";
import { PHRASES, CHARACTERS, phraseFor } from "./phrases";

var CFG = import_node_path.join(process.env.APPDATA || "", "astra", "astra", "config");
var PACK_ROOT = import_node_path.join(CFG, "companion", "pack");
var DATA = import_node_path.join(CFG, "companion-life");
var SETTINGS_FILE = import_node_path.join(DATA, "settings.json");
var SOUL_FILE = import_node_path.join(DATA, "soul.json");
var AWAY_SEC = 1200;
var WORK_FLAG = import_node_path.join(process.env.APPDATA || "", "astra", "work_mode.on");
var WORK_STATE = "as_work";
var pick = (a) => a[Math.floor(Math.random() * a.length)];
var minutes = (lo, hi) => (lo + Math.random() * (hi - lo)) * 60000;
var clamp = (x) => Math.max(0, Math.min(100, x));
var dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── settings ────────────────────────────────────────────────────────────────
// character: how she is (cheerful / shy / lazy / energetic / tsundere); name: how she calls you;
// quiet: hours she keeps her words to herself; calls: quiet while a microphone is in use; games:
// cheer in games and ask after them; questions: ask you things; play: the little games; setup: the
// first-run steps are done.
var SOUL_DEFAULTS = { on: true, talk: true, pace: 1, character: "cheerful", name: "", quiet: { on: true, from: 23, to: 8 },
  calls: true, games: true, questions: true, play: true, setup: false };

function loadDb() {
  let s = {};
  try {
    s = JSON.parse(import_node_fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {}
  const soul = { ...SOUL_DEFAULTS, ...s, quiet: { ...SOUL_DEFAULTS.quiet, ...s.quiet } };
  if (!CHARACTERS.includes(soul.character)) soul.character = "cheerful";
  return { soul };
}

function saveSettings(s) {
  import_node_fs.mkdirSync(DATA, { recursive: true });
  import_node_fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

// ── the worn character and her pack ─────────────────────────────────────────
function activeCharacter() {
  try {
    const t = import_node_fs.readFileSync(import_node_path.join(PACK_ROOT, "companion.toml"), "utf8");
    return /^\s*character\s*=\s*"([^"]*)"/m.exec(t)?.[1] || "";
  } catch {
    return "";
  }
}

// the animation pack file the worn character plays, when it is one on disk (a built-in pack is not)
function basePackFile(charId = activeCharacter()) {
  try {
    const t = import_node_fs.readFileSync(import_node_path.join(PACK_ROOT, "characters", charId, "character.toml"), "utf8");
    const pack = /^\s*animpack\s*=\s*"([^"]*)"/m.exec(t)?.[1] || "";
    if (!pack || pack.includes(":")) return null;
    const f = import_node_path.join(PACK_ROOT, "animpacks", pack, "animpack.toml");
    return import_node_fs.existsSync(f) ? f : null;
  } catch {
    return null;
  }
}

// ── Astra's log: what the avatar engine says ────────────────────────────────
function latestLog() {
  const dir = import_node_path.join(CFG, "logs");
  const files = import_node_fs.readdirSync(dir).filter((f) => f.startsWith("daemon.log")).map((f) => import_node_path.join(dir, f));
  files.sort((a, b) => import_node_fs.statSync(b).mtimeMs - import_node_fs.statSync(a).mtimeMs);
  return files[0];
}

// What the engine last said she is doing: { state, at (ms), music (ms of the last music cue, 0 = none) }
function avatarState() {
  const out = { state: "idle", at: 0, music: 0 };
  try {
    const log = latestLog();
    const fd = import_node_fs.openSync(log, "r");
    const size = import_node_fs.fstatSync(fd).size;
    const n = Math.min(size, 256 * 1024);
    const b = Buffer.alloc(n);
    import_node_fs.readSync(fd, b, 0, n, size - n);
    import_node_fs.closeSync(fd);
    for (const line of b.toString("utf8").split(/\r?\n/)) {
      const at = Date.parse(line.slice(0, 27)) || 0;
      if (/\[manifest\] loaded/.test(line)) Object.assign(out, { state: "greet", at, music: 0 });
      const m = /\[anim\] (\w+) : \S+ -> (\S+)/.exec(line);
      if (!m) continue;
      Object.assign(out, { state: m[2], at });
      if (/^music_(slow|mid|fast)$/.test(m[1])) out.music = at;
      if (m[1] === "music_stop") out.music = 0;
    }
  } catch {}
  return out;
}

// free to do something of her own: not sitting on an edge, not at Astra's work, not dancing
function standing(s = avatarState(), now = Date.now()) {
  if (/^sit/.test(s.state) || s.state.startsWith(WORK_STATE)) return false;
  if (s.music && now - s.music < 120000) return false;
  if (/^(dance|listen)/.test(s.state) && now - s.at < 120000) return false;
  return true;
}

// a nap (a pastime) lasts until something is touched
var dozing = { on: false };

// ── her character ───────────────────────────────────────────────────────────
// How much more (or less) she likes each pastime, how fast her needs move, how often she talks.
var PERSONALITIES = {
  cheerful: { weights: { hum: 1.5, yay: 1.6, spin: 1.3, heart: 1.4, peace: 1.3 }, drift: {}, talk: 1.2 },
  shy: { weights: { shy: 2.5, think: 1.4, heart: 0.8, call: 0.5, yay: 0.6, spin: 0.6 }, drift: { social: 0.8 }, talk: 0.7 },
  lazy: { weights: { yawn: 2, nap: 2, stretch: 1.5, phone: 1.6, phone2: 1.4, spin: 0.4, yay: 0.5 }, drift: { energy: 1.6, boredom: 0.8 }, talk: 0.8 },
  energetic: { weights: { spin: 2, yay: 2, peek: 1.6, hum: 1.2, peace: 1.4, nap: 0.3, yawn: 0.5 }, drift: { energy: 0.6, boredom: 1.4 }, talk: 1.3 },
  tsundere: { weights: { sigh: 2, think: 1.3, heart: 0.7, call: 1.3, shy: 1.4 }, drift: { social: 1.2 }, talk: 1 }
};
var personality = (name) => PERSONALITIES[name] || PERSONALITIES.cheerful;

// ── her needs and mood ──────────────────────────────────────────────────────
// energy falls through the day (faster at night) and comes back in a nap or a night away; boredom
// grows while nothing happens; social falls while you are away; joy drifts back to even. Bond — how
// attached she is to you — grows day by day you spend together and fades a little after days apart.
var soul = { energy: 80, boredom: 20, social: 60, joy: 60, bond: 10, at: 0, next: 0, said: 0, doing: "", doingAt: 0,
  cool: {}, activeSince: 0, breakAt: 0, day: "", snacks: [], pos: 0, log: "", saved: 0, packStates: null, packAt: 0,
  diary: {}, firstDay: "", lastHere: 0, wasAway: false, awayFrom: 0, morningDay: "", diaryDay: "", lateAt: 0,
  typing: 0, typedAt: 0, stuckAt: 0, typeSaid: 0, gameFrom: 0, gameLast: 0, gameCheer: 0, questionAt: 0, playAt: 0,
  game: null, affectionAt: 0 };
var KEEP = ["energy", "boredom", "social", "joy", "bond", "at", "day", "snacks", "cool", "said", "activeSince", "breakAt",
  "diary", "firstDay", "lastHere", "morningDay", "diaryDay", "lateAt", "questionAt", "playAt", "affectionAt"];

function loadSoul() {
  try {
    const s = JSON.parse(import_node_fs.readFileSync(SOUL_FILE, "utf8"));
    for (const k of KEEP) if (k in s) soul[k] = s[k];
  } catch {}
  Object.assign(soul, { pos: 0, log: "", packStates: null });
}

function saveSoul() {
  const out = {};
  for (const k of KEEP) out[k] = soul[k];
  try {
    import_node_fs.mkdirSync(DATA, { recursive: true });
    import_node_fs.writeFileSync(SOUL_FILE, JSON.stringify(out));
  } catch {}
}

function moodOf(s, hour = new Date().getHours()) {
  const night = hour >= 23 || hour < 6;
  if (s.energy < 25 || (night && s.energy < 50)) return "sleepy";
  if (s.social < 30) return "lonely";
  if (s.boredom > 65) return "bored";
  if (s.joy > 70) return "happy";
  return "calm";
}

// what the needs do over `min` minutes, given what she and you are doing (`c`), for her character
function driftSoul(s, min, c, pers = PERSONALITIES.cheerful) {
  const hour = c.hour ?? new Date().getHours();
  const k = (n) => pers.drift?.[n] ?? 1;
  if (c.asleep) s.energy += 2.5 * min;
  else s.energy -= (hour >= 22 || hour < 6 ? 0.3 : 0.12) * min * k("energy");
  s.boredom += (c.music ? -1.5 : c.near ? -3 : 0.6 * k("boredom")) * min;
  if (c.away) s.social -= 0.4 * min * k("social");
  else if (c.here) s.social += 0.5 * min;
  s.joy += (55 - s.joy) * Math.min(1, 0.01 * min) + (c.music ? 0.5 * min : 0) - (s.social < 30 ? 0.3 * min : 0);
  // attachment: about two points an hour together, a little more when she is happy
  if (c.here) s.bond = (s.bond ?? 10) + (0.03 + (s.joy > 70 ? 0.01 : 0)) * min;
  for (const n of ["energy", "boredom", "social", "joy", "bond"]) s[n] = clamp(s[n] ?? 0);
  return s;
}

// days apart cost a little attachment (none for the first two)
function bondAfterAbsence(bond, days) {
  return clamp(bond - Math.max(0, days - 2) * 3);
}

// ── what she does ───────────────────────────────────────────────────────────
// A pastime is a state of her pack. `names` are the state names it may go by in any pack, best
// first: an exact name wins, else a state that has the name as a whole part ("as_mx_wave" for
// "wave"). `moods` weigh it, `when` gates it, `say` is the key of her words for it.
var PASTIMES = [
  { id: "hum", names: ["as_lively_hum", "hum", "humming", "sing", "singing"], moods: { happy: 3, calm: 2 }, say: "hum" },
  { id: "phone", names: ["texting", "phone_texting", "smartphone", "phone_text"], moods: { bored: 3, calm: 1, lonely: 1.5 }, say: "phone" },
  { id: "phone2", names: ["phone", "phone_call", "talking_phone"], moods: { bored: 2, calm: 1 } },
  { id: "think", names: ["think", "thinking", "ponder", "wonder"], moods: { calm: 1.5, bored: 2 }, say: "think" },
  { id: "peek", names: ["as_peek", "peek", "peekaboo"], moods: { bored: 2.5, calm: 0.5 }, say: "peek" },
  { id: "yay", names: ["as_lively_yay", "yay", "cheer_up", "excited", "joy"], moods: { happy: 2 }, say: "yay" },
  { id: "heart", names: ["as_lively_heart", "heart", "love", "kiss"], moods: { happy: 2 }, when: (c) => c.here, say: "heart" },
  { id: "peace", names: ["as_lively_peace", "peace", "v_sign"], moods: { happy: 1.5, calm: 0.5 }, say: "peace" },
  { id: "spin", names: ["spin", "twirl", "turn_around"], moods: { happy: 1.5, bored: 1 }, say: "spin" },
  { id: "shy", names: ["shy", "bashful", "embarrassed"], moods: { happy: 0.7, calm: 0.3 }, say: "shy" },
  { id: "stretch", names: ["stretch", "stretching"], moods: { sleepy: 1.5, calm: 0.5, bored: 0.5 }, say: "stretch" },
  { id: "yawn", names: ["yawn", "yawning", "sleepy"], moods: { sleepy: 3 }, say: "sleepy" },
  // you are not here and she is tired: a nap until you come back
  { id: "nap", names: ["as_sleep", "nap", "doze"], moods: { sleepy: 3 }, when: (c) => c.away, nap: true, say: "nap" },
  { id: "sigh", names: ["relief", "sigh"], moods: { bored: 1, lonely: 1 }, say: "sigh" },
  { id: "sad", names: ["sad", "cry", "sorrow"], moods: { lonely: 2 }, say: "lonely" },
  { id: "call", names: ["hello", "wave", "greeting", "hi"], moods: { lonely: 3 }, when: (c) => c.here, say: "call" },
  { id: "snack", names: ["eat", "eating", "snack", "consume"], moods: { happy: 1, calm: 1, bored: 1, lonely: 1, sleepy: 1 }, snack: true, say: "snack" }
];
var SNACK_HOURS = [[12, 14], [16, 17], [20, 21]];
// states that are hers to be in, not pastimes
var SYSTEM = /^(idle|greet|drag|depart|move|air|seat|sit|dance|listen|as_work|as_walk)/;

// the state a pastime goes by in this pack ("" when there is none)
function stateFor(p, have) {
  for (const n of p.names) if (have.has(n)) return n;
  for (const n of p.names) {
    const re = new RegExp(`(^|_)${n}(_|$)`);
    for (const s of have) if (!SYSTEM.test(s) && re.test(s)) return s;
  }
  return "";
}

// one pastime for the mood: weighted by it and her character, gated by the hour, what she has, and a
// cool-down. Returned with the state it plays (`use`).
function pickPastime(mood, c, have, cool, now, rnd = Math.random, pers = PERSONALITIES.cheerful) {
  const hour = c.hour;
  const open = [];
  for (const p of PASTIMES) {
    if (!(p.moods[mood] > 0)) continue;
    const use = stateFor(p, have);
    if (!use) continue;
    if (p.when && !p.when(c)) continue;
    if (p.snack && (!SNACK_HOURS.some(([a, b]) => hour >= a && hour < b) || c.snacks?.includes(`${c.day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`))) continue;
    if (cool[p.id] > now) continue;
    open.push({ ...p, use, w: p.moods[mood] * (pers.weights?.[p.id] ?? 1) });
  }
  // snack time comes first when it is open
  const snack = open.find((p) => p.snack);
  if (snack) return snack;
  const total = open.reduce((t, p) => t + p.w, 0);
  let r = rnd() * total;
  for (const p of open) if ((r -= p.w) <= 0) return p;
  return open[open.length - 1] || null;
}

// the states her own pack has (re-read every five minutes: an Apply may change it)
function packStates() {
  if (soul.packStates && Date.now() - soul.packAt < 300000) return soul.packStates;
  let text = "";
  try {
    const f = basePackFile();
    if (f) text = import_node_fs.readFileSync(f, "utf8");
  } catch {}
  soul.packStates = new Set([...text.matchAll(/^\[states\.([\w-]+)\]/gm)].map((m) => m[1]));
  soul.packAt = Date.now();
  return soul.packStates;
}

// ── her diary: the day in numbers ───────────────────────────────────────────
// work: minutes you were at the computer; pats; naps; music: minutes it played; games; chats (Astra's
// work); pastimes; late: minutes past midnight at the computer; bond at the end of the day.
function diaryToday(day = dayKey()) {
  if (!soul.diary[day]) soul.diary[day] = { work: 0, pats: 0, naps: 0, music: 0, games: 0, chats: 0, pastimes: 0, late: 0, played: 0, found: 0 };
  // two weeks are kept
  const days = Object.keys(soul.diary).sort();
  while (days.length > 14) delete soul.diary[days.shift()];
  return soul.diary[day];
}

function spanText(min, ru) {
  const m = Math.round(min);
  if (m < 60) return ru ? `${m} мин` : `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return ru ? `${h} ч${r ? ` ${r} мин` : ""}` : `${h} h${r ? ` ${r} min` : ""}`;
}

// ── words ───────────────────────────────────────────────────────────────────
var ctxLang = "ru";

// quiet: her quiet hours, or a microphone in use by something else (a call)
function quietNow(s, hour = new Date().getHours()) {
  if (s.calls && activity.mic) return true;
  if (!s.quiet?.on) return false;
  const { from, to } = s.quiet;
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}

// A word for `key`. Not more often than once in 15 minutes (less for a quiet character), only while
// you are here, never in a game, never in quiet hours or a call. `force` skips the dice and the
// interval (for what you asked for: a game, a greeting); `vars` fill the phrase.
async function say(ctx, db, key, { force = false, vars = {} } = {}) {
  const s = db.soul, now = Date.now();
  if (!s.talk || quietNow(s) || GAMES.has(activity.proc) || activity.idleSec > 300) return false;
  const pers = personality(s.character);
  if (!force && (now - soul.said < 15 * 60000 / pers.talk || Math.random() > 0.45 * pers.talk)) return false;
  const text = phraseFor(ctxLang === "ru" ? "ru" : "en", key, s.character, { name: s.name, ...vars });
  if (!text) return false;
  soul.said = now;
  await ctx.fireTrigger("anim_say", { text }).catch(() => {});
  return true;
}

// ── what happened in the engine since the last look: pats, Astra's work, music ──
function soulEvents() {
  const ev = { pat: 0, patEnd: 0, work: 0, music: false };
  try {
    const log = latestLog();
    const size = import_node_fs.statSync(log).size;
    if (log !== soul.log || size < soul.pos) Object.assign(soul, { log, pos: size });
    if (size === soul.pos) return ev;
    const fd = import_node_fs.openSync(log, "r");
    const buf = Buffer.alloc(Math.min(size - soul.pos, 1 << 20));
    import_node_fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    import_node_fs.closeSync(fd);
    soul.pos = size;
    for (const line of buf.toString("utf8").split(/\r?\n/)) {
      if (/\[interaction\] head_stroke_start :/.test(line)) ev.pat++;
      if (/\[interaction\] head_stroke_end :/.test(line)) ev.patEnd++;
      if (/\[anim\] action_start :/.test(line)) ev.work++;
      if (/\[anim\] music_(slow|mid|fast) :/.test(line)) ev.music = true;
    }
  } catch {}
  return ev;
}

function soulNow() {
  if (!soul.at) loadSoul();
  const r = (x) => Math.round(x);
  const t = diaryToday();
  return { mood: moodOf(soul), energy: r(soul.energy), boredom: r(soul.boredom), social: r(soul.social), joy: r(soul.joy), bond: r(soul.bond),
    doing: soul.doing, doingAgo: soul.doingAt ? r((Date.now() - soul.doingAt) / 1000) : null,
    nextIn: soul.next ? Math.max(0, r((soul.next - Date.now()) / 1000)) : null,
    workingFor: soul.activeSince ? r((Date.now() - soul.activeSince) / 60000) : 0,
    together: soul.firstDay ? Math.max(1, Math.round((Date.now() - Date.parse(soul.firstDay)) / 86400000) + 1) : 1,
    today: { ...t, work: r(t.work), music: r(t.music), late: r(t.late) }, mic: !!activity.mic, quiet: quietNow(loadDb().soul),
    game: soul.game?.kind || "" };
}

// the diary's days, newest first, each with a line in her words
function diaryList(db) {
  const ru = ctxLang === "ru";
  return Object.keys(soul.diary).sort().reverse().map((day) => {
    const d = soul.diary[day];
    return { day, ...d, work: Math.round(d.work), music: Math.round(d.music), late: Math.round(d.late),
      text: phraseFor(ru ? "ru" : "en", "diary", db.soul.character, { name: db.soul.name, work: spanText(d.work, ru), pats: d.pats, naps: d.naps,
        music: spanText(d.music, ru), games: d.games }, () => 0.99) };
  });
}

// ── the little games with your pointer ──────────────────────────────────────
// hide: she peeks out from under her window's edge — point at her before she hides again;
// catch: she throws a heart — point at her before it flies away. A win lifts her joy and your bond.
var GAMES_PLAY = { hide: { names: ["as_peek", "peek"], secs: 14, start: "hideStart", win: "hideFound", miss: "hideMissed" },
  catch: { names: ["as_lively_heart", "heart"], secs: 8, start: "catchStart", win: "catchWin", miss: "catchMiss" } };

async function startGame(ctx, db, kind, have, now) {
  const g = GAMES_PLAY[kind];
  const use = stateFor({ names: g.names }, have);
  if (!use) return false;
  soul.game = { kind, until: now + g.secs * 1000, seen: 0 };
  soul.playAt = now;
  soul.doing = use;
  soul.doingAt = now;
  await say(ctx, db, g.start, { force: true });
  await ctx.fireTrigger("anim_play", { state: use }).catch(() => {});
  return true;
}

async function gameTick(ctx, db, have, now) {
  const g = soul.game;
  if (!g) return;
  const rules = GAMES_PLAY[g.kind];
  // the pointer over her window for most of a 2-second look: found / caught
  if (activity.over >= 8) {
    soul.game = null;
    Object.assign(soul, { joy: clamp(soul.joy + 15), bond: clamp(soul.bond + 1), boredom: clamp(soul.boredom - 20) });
    const t = diaryToday();
    t.played++;
    t.found++;
    const happy = stateFor({ names: ["as_lively_yay", "laugh", "clap", "excited", "yay"] }, have);
    if (happy) await ctx.fireTrigger("anim_play", { state: happy }).catch(() => {});
    await say(ctx, db, rules.win, { force: true });
  } else if (now > g.until) {
    soul.game = null;
    diaryToday().played++;
    await say(ctx, db, rules.miss, { force: true });
  }
}

// ── the clock of it all ─────────────────────────────────────────────────────
async function soulTick(ctx) {
  const db = loadDb();
  const s = db.soul;
  if (!s.on) return;
  const pers = personality(s.character);
  const now = Date.now(), d = new Date(), hour = d.getHours(), day = dayKey(d);
  if (!soul.at) {
    loadSoul();
    // a night away: she slept
    if (soul.at && now - soul.at > 4 * 3600000) Object.assign(soul, { energy: 90, boredom: 20 });
    // days apart
    if (soul.lastHere) soul.bond = bondAfterAbsence(soul.bond, Math.floor((now - soul.lastHere) / 86400000));
  }
  if (!soul.firstDay) soul.firstDay = day;
  const min = Math.min(10, soul.at ? (now - soul.at) / 60000 : 0);
  soul.at = now;
  if (soul.day !== day) Object.assign(soul, { day, snacks: [] });
  const ev = soulEvents();
  const st = avatarState();
  const music = !!st.music && now - st.music < 75000;
  const here = activity.idleSec < 120, away = activity.idleSec > 600;
  const today = diaryToday(day);
  if (here) {
    today.work += min;
    if (hour < 5) today.late += min;
  }
  if (music) today.music += min;
  const c = { hour, day, music, here, away, near: activity.over >= 10, asleep: dozing.on, snacks: soul.snacks };
  driftSoul(soul, min, c, pers);
  if (ev.pat) {
    Object.assign(soul, { joy: clamp(soul.joy + 15), social: clamp(soul.social + 20), boredom: clamp(soul.boredom - 20), bond: clamp(soul.bond + 0.5 * ev.pat) });
    today.pats += ev.pat;
  }
  if (ev.work) {
    Object.assign(soul, { social: clamp(soul.social + 10), boredom: clamp(soul.boredom - 10), bond: clamp(soul.bond + 0.3) });
    today.chats += ev.work;
  }
  if (now - soul.saved > 120000) {
    soul.saved = now;
    saveSoul();
  }
  const have = packStates();
  const free = standing(st) && !dozing.on && !(import_node_fs.existsSync(WORK_FLAG) && activity.idleSec < 30);
  const play = async (state) => {
    soul.doing = state;
    soul.doingAt = now;
    await ctx.fireTrigger("anim_play", { state }).catch(() => {});
  };

  // ── you came back, the first time today, after hours, after days ──
  if (activity.idleSec >= AWAY_SEC && !soul.wasAway) Object.assign(soul, { wasAway: true, awayFrom: now - activity.idleSec * 1000 });
  if (here && activity.idleSec < 5) {
    const gone = soul.wasAway ? now - soul.awayFrom : soul.lastHere ? now - soul.lastHere : 0;
    const first = soul.morningDay !== day && hour >= 5;
    if (soul.wasAway || first) {
      soul.wasAway = false;
      Object.assign(soul, { joy: clamp(soul.joy + 20), social: clamp(soul.social + 15) });
      const days = Math.floor(gone / 86400000);
      const key = days >= 2 ? "missed" : first && hour < 12 ? "morning" : gone > 3 * 3600000 ? "backLong" : "back";
      if (first) soul.morningDay = day;
      if (free) {
        const wave = stateFor({ names: ["hello", "wave", "greeting"] }, have);
        if (wave) await play(wave);
      }
      await say(ctx, db, key, { force: true, vars: { days } });
    }
    soul.lastHere = now;
  }
  if (here) soul.lastHere = now;

  // ── a little game in progress ──
  if (soul.game) return gameTick(ctx, db, have, now);

  // ── your typing: long runs of it, and the pause after (stuck?) ──
  const typingNow = activity.idleSec < 1.5 && activity.path < 30;
  if (typingNow) {
    soul.typing += 2;
    soul.typedAt = now;
  } else if (activity.idleSec > 8 && soul.typing && now - soul.typedAt > 8000) {
    // a pause after twenty minutes of typing: in two to five minutes, a word (once in forty minutes)
    if (soul.typing > 1200 && activity.idleSec > 120 && activity.idleSec < 300 && now - soul.stuckAt > 40 * 60000 && free) {
      soul.stuckAt = now;
      soul.typing = 0;
      const t = stateFor({ names: ["think", "thinking"] }, have);
      if (t) await play(t);
      await say(ctx, db, "stuck", { force: true });
      return;
    }
    if (activity.idleSec > 300) soul.typing = 0;
  }
  if (soul.typing > 1800 && now - soul.typeSaid > 60 * 60000 && free) {
    soul.typeSaid = now;
    const p = stateFor({ names: ["texting", "phone_texting"] }, have);
    if (p) await play(p);
    await say(ctx, db, "typingLong");
    return;
  }

  // ── games: a quiet cheer now and then, and a word after a session ──
  if (GAMES.has(activity.proc)) {
    if (!soul.gameFrom) soul.gameFrom = now;
    soul.gameLast = now;
    if (s.games && free && now - soul.gameCheer > minutes(10, 20)) {
      soul.gameCheer = now;
      const cheer = stateFor({ names: ["as_lively_cheer", "cheer", "clap"] }, have);
      if (cheer && Math.random() < 0.4) await play(cheer);
    }
    return;
  }
  if (soul.gameFrom && now - soul.gameLast > 90000) {
    const long = soul.gameLast - soul.gameFrom > 10 * 60000;
    soul.gameFrom = 0;
    if (long) {
      today.games++;
      soul.boredom = clamp(soul.boredom - 15);
      if (s.games && free) {
        const r = stateFor({ names: Math.random() < 0.5 ? ["as_lively_yay", "excited", "clap"] : ["hello", "wave", "thankful"] }, have);
        if (r) await play(r);
        await say(ctx, db, "gameEnd", { force: true });
        return;
      }
    }
  }

  if (!free) return;

  // ── after a pat, a shy smile or a heart now and then ──
  if (ev.patEnd && Math.random() < 0.5 && !(soul.cool.pat > now)) {
    soul.cool.pat = now + 120000;
    const r = stateFor({ names: pers === PERSONALITIES.shy || pers === PERSONALITIES.tsundere ? ["shy", "bashful"] : ["as_lively_heart", "shy", "heart"] }, have);
    if (r) await play(r);
    await say(ctx, db, "pat");
    return;
  }
  // ── music she likes ──
  if (ev.music && Math.random() < 0.1 && !(soul.cool.music > now)) {
    soul.cool.music = now + 30 * 60000;
    await say(ctx, db, "musicLike");
  }

  // ── late at night at the computer: gentle, then firmer ──
  if (here && hour < 5 && now - soul.lateAt > (hour >= 2 ? 30 : 50) * 60000) {
    soul.lateAt = now;
    const y = stateFor({ names: ["yawn", "sleepy"] }, have);
    if (y) await play(y);
    await say(ctx, db, hour >= 2 ? "lateDeep" : "late", { force: true, vars: { hour } });
    return;
  }

  // ── an hour and a half without a break ──
  if (activity.idleSec > 300) soul.activeSince = 0;
  else if (!soul.activeSince) soul.activeSince = now;
  if (soul.activeSince && now - soul.activeSince > 90 * 60000 && now - soul.breakAt > 90 * 60000) {
    soul.breakAt = now;
    const t = stateFor({ names: ["stretch", "stretching"] }, have);
    if (t) await play(t);
    await say(ctx, db, "break", { force: true, vars: { hours: spanText((now - soul.activeSince) / 60000, ctxLang === "ru") } });
    return;
  }

  // ── the evening: the day in her diary, once ──
  if (here && hour >= 21 && hour < 24 && soul.diaryDay !== day && today.work > 60) {
    soul.diaryDay = day;
    const ru = ctxLang === "ru";
    await say(ctx, db, "diary", { force: true, vars: { work: spanText(today.work, ru), pats: today.pats, naps: today.naps, music: spanText(today.music, ru), games: today.games } });
    return;
  }

  if (!soul.next) soul.next = now + minutes(1, 3);
  if (now < soul.next) return;
  const mood = moodOf(soul, hour);
  const pace = Math.max(0.3, Math.min(3, Number(s.pace) || 1));
  const gap = mood === "bored" ? [2, 4] : mood === "sleepy" ? [5, 9] : [3, 7];
  soul.next = now + minutes(gap[0] / pace, gap[1] / pace);

  // ── now and then, instead of a pastime: a game, a question, a warm word ──
  if (here && s.play && (mood === "bored" || mood === "happy") && now - soul.playAt > 50 * 60000 && Math.random() < 0.35) {
    if (await startGame(ctx, db, Math.random() < 0.5 ? "hide" : "catch", have, now)) return;
  }
  if (here && s.questions && (mood === "calm" || mood === "happy") && now - soul.questionAt > 90 * 60000 && Math.random() < 0.25) {
    soul.questionAt = now;
    const t = stateFor({ names: ["think", "thinking"] }, have);
    if (t) await play(t);
    await say(ctx, db, "question", { force: true });
    return;
  }
  if (here && soul.bond > 60 && now - soul.affectionAt > 3 * 3600000 && Math.random() < 0.3) {
    soul.affectionAt = now;
    const h = stateFor({ names: ["as_lively_heart", "heart", "shy"] }, have);
    if (h) await play(h);
    await say(ctx, db, "affection", { force: true });
    return;
  }

  const p = pickPastime(mood, c, have, soul.cool, now, Math.random, pers);
  if (!p) return;
  soul.cool[p.id] = now + minutes(12, 25);
  if (p.snack) soul.snacks.push(`${day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`);
  soul.boredom = clamp(soul.boredom - 25);
  today.pastimes++;
  if (p.id === "call" || p.id === "heart") soul.social = clamp(soul.social + 5);
  if (p.nap) {
    dozing.on = true;
    today.naps++;
  }
  await play(p.use);
  if (p.say) await say(ctx, db, p.say, { force: p.id === "call" || !!p.snack });
}

// ── watching activity: time since the last input, the foreground process, the pointer, a microphone ─
// Only these are read — never the keys themselves. Over every 2 s the pointer is looked at 20 times:
// how far it went, how often it turned back, and how much of the time it was over her window. Every
// 10 s: whether any program but Astra holds a microphone (Windows marks it in the privacy store).
var GAMES = new Set(["dota2", "cs2", "valorant", "valorant-win64-shipping", "deadlock", "project8", "genshinimpact",
  "cyberpunk2077", "robloxplayerbeta", "javaw", "eldenring", "r5apex", "r5apex_dx12", "fortniteclient-win64-shipping",
  "overwatch", "leagueoflegends", "league of legends", "minecraft", "pubg", "tslgame", "rainbowsix", "gta5", "bf2042"]);
var WATCH_PS = `
Add-Type @'
using System; using System.Runtime.InteropServices;
public class AI {
  [StructLayout(LayoutKind.Sequential)] public struct L { public uint cb; public uint t; }
  [StructLayout(LayoutKind.Sequential)] public struct P { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Ri, B; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref L l);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out P p);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public static IntPtr Find(uint pid) {
    IntPtr best = IntPtr.Zero; long area = 0;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid && IsWindowVisible(h)) { R r; GetWindowRect(h, out r); long a = (long)(r.Ri - r.L) * (r.B - r.T); if (a > area) { area = a; best = h; } }
      return true; }, IntPtr.Zero);
    return best;
  }
}
'@
$micRoot = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'
$mic = 0; $n = 0
while ($true) {
  $l = New-Object AI+L; $l.cb = 8; [AI]::GetLastInputInfo([ref]$l) | Out-Null
  $idle = ([uint32]([Environment]::TickCount -band 0xFFFFFFFF) - $l.t) -band 0xFFFFFFFF
  $fp = 0; [AI]::GetWindowThreadProcessId([AI]::GetForegroundWindow(), [ref]$fp) | Out-Null
  $name = (Get-Process -Id $fp -ErrorAction SilentlyContinue).ProcessName
  $av = Get-Process astra-avatar-engine -ErrorAction SilentlyContinue | Select-Object -First 1
  $h = if ($av) { [AI]::Find([uint32]$av.Id) } else { [IntPtr]::Zero }
  $r = New-Object AI+R; if ($h -ne [IntPtr]::Zero) { [AI]::GetWindowRect($h, [ref]$r) | Out-Null }
  if ($n % 5 -eq 0) {
    $mic = 0
    foreach ($k in @(Get-ChildItem $micRoot -ErrorAction SilentlyContinue) + @(Get-ChildItem "$micRoot\\NonPackaged" -ErrorAction SilentlyContinue)) {
      if ($k.PSChildName -match '(?i)astra|sherpa|stt|vox|NonPackaged') { continue }
      $v = (Get-ItemProperty $k.PSPath -Name LastUsedTimeStop -ErrorAction SilentlyContinue).LastUsedTimeStop
      if ($null -ne $v -and $v -eq 0) { $mic = 1; break }
    }
  }
  $n++
  $path = 0; $turns = 0; $over = 0; $px = $null; $py = 0; $dx0 = 0
  for ($i = 0; $i -lt 20; $i++) {
    $p = New-Object AI+P; [AI]::GetCursorPos([ref]$p) | Out-Null
    if ($null -ne $px) {
      $dx = $p.X - $px; $path += [Math]::Abs($dx) + [Math]::Abs($p.Y - $py)
      if ([Math]::Abs($dx) -gt 15) { if ($dx0 -ne 0 -and [Math]::Sign($dx) -ne [Math]::Sign($dx0)) { $turns++ }; $dx0 = $dx }
    }
    $px = $p.X; $py = $p.Y
    if ($p.X -ge $r.L -and $p.X -lt $r.Ri -and $p.Y -ge $r.T -and $p.Y -lt $r.B -and $r.Ri -gt $r.L) { $over++ }
    Start-Sleep -Milliseconds 100
  }
  [Console]::Out.WriteLine("$idle|$name|$path|$turns|$over|$mic"); [Console]::Out.Flush()
}`;
var activity = { idleSec: 0, proc: "", seen: false, path: 0, turns: 0, over: 0, mic: 0 };

function startWatch(ctx) {
  const child = import_node_child_process.spawn("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", WATCH_PS],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  child.unref(); // the watcher never keeps the plugin process alive by itself
  child.stdout.unref?.();
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      const [idleStr, proc = "", path, turns, over, mic] = line.trim().split("|");
      const idleSec = Number(idleStr) / 1000;
      if (!Number.isFinite(idleSec)) continue;
      activity = { idleSec, proc: proc.toLowerCase(), seen: true, path: Number(path) || 0, turns: Number(turns) || 0, over: Number(over) || 0, mic: Number(mic) || 0 };
      wakeTick(ctx).catch(() => {});
      soulTick(ctx).catch(() => {});
    }
  });
  child.on("exit", () => setTimeout(() => startWatch(ctx), 10000).unref()); // died — start again
}

// a nap ends the moment something is touched (unless Astra's work already took her)
async function wakeTick(ctx) {
  if (!dozing.on || activity.idleSec >= 3) return;
  dozing.on = false;
  if (avatarState().state.startsWith(WORK_STATE)) return;
  await ctx.fireTrigger("anim_play", { state: "idle" }).catch(() => {});
}

// ── the two Astra commands that act on this plugin's triggers ───────────────
// Astra reads commands.json when it starts and does not write it back on its own, so the commands are
// added to the file and appear after Astra is restarted.
var COMMANDS = import_node_path.join(CFG, "commands.json");
var TRIGGER_PREFIX = "plugin__companion_life__";
var COMMAND_TRIGGERS = ["anim_play", "anim_say"];

function commandSpecs(ru) {
  return [
    { trigger: "anim_play", name: ru ? "Companion Life: занятие" : "Companion Life: a pastime",
      action: { mode: "state", state: "{state}", trigger: "", type: "companion_animation" } },
    { trigger: "anim_say", name: ru ? "Companion Life: сказать" : "Companion Life: say",
      action: { text: "{text}", tts_pitch: 1, tts_speed: 0.85, type: "speak", use_settings_voice: false, voices: {} } }
  ];
}

function readCommands() {
  try {
    return JSON.parse(import_node_fs.readFileSync(COMMANDS, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

function commandsStatus(ctx) {
  const list = readCommands() || [];
  const active = [...(ctx?.activeTriggers || [])];
  const out = {};
  for (const t of COMMAND_TRIGGERS) {
    const inFile = list.some((c) => (c.triggers || []).some((x) => x.handler_id === TRIGGER_PREFIX + t));
    out[t] = { inFile, listening: active.some((a) => a === t || a === TRIGGER_PREFIX + t) };
  }
  return out;
}

function createCommands(ctx) {
  const list = readCommands();
  if (!Array.isArray(list)) throw new Error(`cannot read ${COMMANDS}`);
  const have = commandsStatus(ctx);
  const stamp = new Date().toISOString();
  let added = 0;
  commandSpecs(ctx?.language === "ru").forEach((spec, i) => {
    if (have[spec.trigger].inFile) return;
    const handler = TRIGGER_PREFIX + spec.trigger;
    const t = Date.now() + i;
    const tn = `node_1_${t}`, an = `node_2_${t}`, edge = `xy-edge__${tn}-${an}`;
    list.push({
      actions: [spec.action], created_at: stamp, description: "Created by the Companion Life plugin", editor_mode: "graph",
      enabled: true, execution: {}, id: globalThis.crypto.randomUUID(), name: spec.name, priority: 4,
      slash_description: "", slash_enabled: false, tags: [],
      triggers: [{ config: {}, handler_id: handler, type: "dynamic" }], updated_at: stamp,
      workflow: {
        edge_order: [edge],
        edges: { [edge]: { id: edge, source_node: tn, source_port: "default", target_node: an, target_port: "default" } },
        nodes: {
          [tn]: { data: { config: {}, trigger_type: handler }, id: tn, label: "", node_type: "trigger", position_x: 0, position_y: 0 },
          [an]: { data: { action: spec.action, action_type: spec.action.type, config: spec.action, wait_for_completion: "false" },
            id: an, label: "", node_type: "action", position_x: 360, position_y: 0 }
        }
      }
    });
    added++;
  });
  if (added) {
    if (!import_node_fs.existsSync(COMMANDS + ".before-companion-life")) import_node_fs.copyFileSync(COMMANDS, COMMANDS + ".before-companion-life");
    import_node_fs.writeFileSync(COMMANDS, JSON.stringify(list, null, 2));
  }
  return { added, commands: commandsStatus(ctx) };
}

function getState(ctx) {
  const db = loadDb();
  const have = packStates();
  return { soul: { ...db.soul, now: soulNow() }, commands: commandsStatus(ctx), character: activeCharacter(), ownPack: !!basePackFile(),
    characters: CHARACTERS, diary: diaryList(db),
    pastimes: PASTIMES.map((p) => ({ id: p.id, state: stateFor(p, have) })) };
}

export const app = plugin({
  id: "companion-life",
  triggers: {
    anim_play: { label: "Companion Life: the avatar plays a state ({state})", fields: [] },
    anim_say: { label: "Companion Life: a phrase to say ({text})", fields: [] }
  },
  onStart: async (ctx) => {
    ctxLang = ctx.language || "ru";
    startWatch(ctx);
  },
  ui: {
    contributions: [{
      id: "companion-life", slot: "page.custom", label: "Companion Life",
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9 11h1.5l1-2 1.5 4 1-2H15"/></svg>',
      url: "index.html", width: 0, height: 0, transparent: true
    }],
    onCall: {
      getState: async (_p, ctx) => getState(ctx),
      soulNow: async () => soulNow(),
      setSoul: async (p) => {
        const s = loadDb().soul;
        const patch = p.patch || {};
        for (const k of ["on", "talk", "calls", "games", "questions", "play", "setup"]) if (k in patch) s[k] = !!patch[k];
        if ("pace" in patch) s.pace = Math.max(0.3, Math.min(3, Number(patch.pace) || 1));
        if ("character" in patch && CHARACTERS.includes(patch.character)) s.character = patch.character;
        if ("name" in patch) s.name = String(patch.name || "").trim().slice(0, 30);
        if (patch.quiet) {
          if ("on" in patch.quiet) s.quiet.on = !!patch.quiet.on;
          for (const k of ["from", "to"]) if (k in patch.quiet) s.quiet[k] = Math.max(0, Math.min(23, Math.round(Number(patch.quiet[k]) || 0)));
        }
        saveSettings(s);
        soul.next = 0;
        return s;
      },
      // something now, whatever the clock says
      nudge: async () => {
        soul.next = 1;
        Object.keys(soul.cool).forEach((k) => delete soul.cool[k]);
        return true;
      },
      // a little game right away (from the page)
      playGame: async (p, ctx) => {
        if (soul.game) return { ok: false, note: "busy" };
        const ok = await startGame(ctx, loadDb(), p.kind === "catch" ? "catch" : "hide", packStates(), Date.now());
        return { ok };
      },
      // a word right away, to hear her (the page's "try")
      sayNow: async (p, ctx) => {
        const s = loadDb().soul;
        const text = phraseFor(ctxLang === "ru" ? "ru" : "en", String(p.key || "pat"), s.character, { name: s.name, days: 3, hour: 2, hours: "2 ч",
          work: "3 ч", pats: 5, naps: 1, music: "40 мин", games: 2 });
        if (text) await ctx.fireTrigger("anim_say", { text }).catch(() => {});
        return text;
      },
      createCommands: async (_p, ctx) => createCommands(ctx)
    }
  },
  healthCheck: () => ({ healthy: true, status: "ok" })
});
// for test/*.test.mjs
export const internals = { moodOf, driftSoul, pickPastime, stateFor, bondAfterAbsence, quietNow, PASTIMES, PHRASES, CHARACTERS, phraseFor,
  standing, soul, soulNow, soulTick, diaryToday, spanText, PERSONALITIES, activity: () => activity };
if (require.main === module) app.run();
