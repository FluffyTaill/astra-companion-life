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
import { plugin, s as schema, tool } from "astra-plugin-sdk";
import { PHRASES, CHARACTERS, LANGS, phraseFor } from "./phrases";
import { GIFTS, HOBBIES, LEVELS, ACHIEVEMENTS } from "./phrases2";
// things she holds and things around her (tools/gen_life_assets.py)
import BOOK_GLB from "../assets/book.glb";
import CUP_GLB from "../assets/cup.glb";
import PLUSH_GLB from "../assets/plush.glb";
import HOLD_VRMA from "../assets/hold.vrma";
import HUG_VRMA from "../assets/hug.vrma";
import STAR_PNG from "../assets/star.png";
import FIREFLY_PNG from "../assets/firefly.png";

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
  calls: true, games: true, questions: true, play: true, setup: false,
  // lang: "auto" (Astra's) / ru / en / ja; weather: her mood follows it; apps: words about your programs, appRules: your own
  // [{match, text}]; pomodoro: a tomato timer; custom: your own phrases by situation; voiceMood: softer or brighter voice
  // by mood; care: water and eyes; goalHours: a goal for the day; chatTone: she reads the tone of your messages to Astra
  // (here only); aiWords: Astra's AI writes her a line now and then (needs the catalog's chat permission); props, sky:
  // things in her hands, the sky of the hour (in her pack); birthday: "MM-DD"; dndUntil: quiet until; plan: today's
  // plan typed on the page
  lang: "auto", weather: true, apps: true, appRules: [], pomodoro: { on: false, work: 25, rest: 5 }, custom: {}, voiceMood: true,
  care: true, goalHours: 0, chatTone: false, aiWords: false, props: false, sky: true, birthday: "", dndUntil: 0, plan: "", planDay: "" };

function loadDb() {
  let s = {};
  try {
    s = JSON.parse(import_node_fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {}
  const soul = { ...SOUL_DEFAULTS, ...s, quiet: { ...SOUL_DEFAULTS.quiet, ...s.quiet }, pomodoro: { ...SOUL_DEFAULTS.pomodoro, ...s.pomodoro } };
  if (!["auto", ...LANGS].includes(soul.lang)) soul.lang = "auto";
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
  game: null, affectionAt: 0,
  hunger: 30, restless: 20, totals: { pats: 0, found: 0, lateNights: 0, workMin: 0, musicMin: 0, wishes: 0, goals: 0 }, arrivals: {}, bedtimes: {},
  weather: { at: 0, kind: "", temp: 10 }, weatherSaid: "", app: { kind: "", since: 0 }, appSeen: {}, pomo: null, sulk: false, sulkAt: 0, noticedAt: 0,
  wish: null, wishAt: 0, gifts: [], giftAt: 0, ach: {}, level: 0, goalSaid: {}, plan: "", planDay: "", planAsked: 0, planAskedDay: "", planCheckDay: "",
  chatPos: {}, toneAt: 0, careAt: 0, careKind: "", callFrom: 0, wasMuted: false, loudAt: 0, batAt: 0, batLow: false, cleanupDay: "", bedSaid: "",
  hobby: null, hobbyDay: "", aiAt: 0, aiBlocked: "", lastDay: "", lastActive: 0, greetDay: "", queue: [], watchAt: 0, holding: null, played: false };
var KEEP = ["energy", "boredom", "social", "joy", "bond", "at", "day", "snacks", "cool", "said", "activeSince", "breakAt",
  "diary", "firstDay", "lastHere", "morningDay", "diaryDay", "lateAt", "questionAt", "playAt", "affectionAt",
  "hunger", "restless", "totals", "arrivals", "bedtimes", "appSeen", "gifts", "giftAt", "ach", "level", "goalSaid", "plan", "planDay", "planAskedDay",
  "planCheckDay", "careAt", "hobby", "hobbyDay", "wishAt", "aiAt", "lastDay", "lastActive", "greetDay", "cleanupDay", "bedSaid", "weatherSaid"];

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
  { id: "snack", names: ["eat", "eating", "snack", "consume"], moods: { happy: 1, calm: 1, bored: 1, lonely: 1, sleepy: 1 }, snack: true, say: "snack" },
  // things in her hands (the block in her pack, when "props" is on): held for half a minute or so
  { id: "read", names: ["cl_read"], moods: { calm: 2, bored: 1.5, sleepy: 0.5 }, hold: true, say: "read" },
  { id: "tea", names: ["cl_tea"], moods: { calm: 1.5, sleepy: 1.5, happy: 0.7 }, hold: true, say: "tea" },
  { id: "hug", names: ["cl_hug"], moods: { lonely: 2, sleepy: 1, happy: 0.8 }, hold: true, say: "hug" }
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
    if (p.snack && !c.hungry && (!SNACK_HOURS.some(([a, b]) => hour >= a && hour < b) || c.snacks?.includes(`${c.day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`))) continue;
    if (cool[p.id] > now) continue;
    // her character, her hobby and her restlessness weigh it too
    open.push({ ...p, use, w: p.moods[mood] * (pers.weights?.[p.id] ?? 1) * (c.boost?.[p.id] ?? 1) });
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
  if (!s.talk || quietNow(s) || s.dndUntil > now || GAMES.has(activity.proc) || activity.idleSec > 300) return false;
  if (soul.sulk && key !== "sulk" && key !== "sulkMakeup") return false;
  const pers = personality(s.character);
  if (!force && (now - soul.said < 15 * 60000 / pers.talk || Math.random() > 0.45 * pers.talk)) return false;
  const text = phraseFor(langOf(s), key, s.character, { name: s.name, ...vars }, Math.random, s.custom?.[key]);
  if (!text) return false;
  soul.said = now;
  // the voice for the mood, when its command is there
  let trigger = voiceTrigger(s, moodOf(soul));
  if (trigger !== "anim_say" && ![...(ctx.activeTriggers || [])].some((a) => a === trigger || a === TRIGGER_PREFIX + trigger)) trigger = "anim_say";
  await ctx.fireTrigger(trigger, { text }).catch(() => {});
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
    soul.totals.found++;
    soul.played = true;
    const happy = stateFor({ names: ["as_lively_yay", "laugh", "clap", "excited", "yay"] }, have);
    if (happy) await ctx.fireTrigger("anim_play", { state: happy }).catch(() => {});
    await say(ctx, db, rules.win, { force: true });
  } else if (now > g.until) {
    soul.game = null;
    diaryToday().played++;
    soul.played = true;
    await say(ctx, db, rules.miss, { force: true });
  }
}

// ── the rest of her life ────────────────────────────────────────────────────
// Habits (when you come and go), hunger and restlessness, the weather, the seasons and dates, your
// programs, a tomato timer, care for your eyes and water, a goal for the day, calls, the sound and the
// battery, sulks and jealousy, hobbies, dreams, wishes, gifts, achievements and friendship levels, a
// morning plan, the tone of your messages to Astra, words written by Astra's AI, and quiet time.
var langOf = (s) => (s.lang && s.lang !== "auto" ? s.lang : /^ru/.test(ctxLang) ? "ru" : /^ja/.test(ctxLang) ? "ja" : "en");
var median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
// hours past noon of the day before count as late evening: 1:30 → 25.5
var lateHour = (d) => d.getHours() + d.getMinutes() / 60 + (d.getHours() < 6 ? 24 : 0);

// your programs, by kind (the foreground process's name)
var APP_KINDS = [
  ["code", /^(code|cursor|pycharm64|pycharm|idea64|idea|webstorm64|rider64|devenv|sublime_text|notepad\+\+|clion64|goland64|zed|windsurf)$/],
  ["video", /^(vlc|mpc-hc64|mpc-hc|potplayermini64|potplayer|mpv|netflix|kinopoisk)$/],
  ["music", /^(spotify|aimp|foobar2000|yandexmusic|winamp|musicbee|applemusic)$/],
  ["chat", /^(discord|telegram|whatsapp|slack|teams|ms-teams|zoom|skype|viber|element)$/],
  ["creative", /^(photoshop|blender|krita|clipstudiopaint|aseprite|illustrator|afterfx|adobe premiere pro|obs64|resolve|vroidstudio|unity|unrealeditor|paintdotnet|gimp-2.10|figma)$/],
  ["office", /^(winword|excel|powerpnt|onenote|notion|obsidian|onlyoffice|soffice)$/],
  ["browser", /^(chrome|msedge|firefox|opera|operagx|brave|vivaldi|yandex|browser|arc|librewolf)$/]
];
var appKindOf = (proc) => APP_KINDS.find(([, re]) => re.test(proc))?.[0] || "";

// the voice for the mood: softer and slower when sleepy or lonely, brighter when happy or energetic
function voiceTrigger(s, mood) {
  if (!s.voiceMood) return "anim_say";
  if (mood === "sleepy" || mood === "lonely") return "anim_say_soft";
  if (mood === "happy" || s.character === "energetic") return "anim_say_bright";
  return "anim_say";
}

function friendship(bond, lang = "ru") {
  let i = 0;
  LEVELS.forEach((l, k) => { if (bond >= l.min) i = k; });
  return { index: i, name: LEVELS[i][lang] || LEVELS[i].en };
}

// her totals for achievements
function totalsOf() {
  const t = soul.totals;
  return { days: soul.firstDay ? Math.floor((Date.now() - Date.parse(soul.firstDay)) / 86400000) + 1 : 1, pats: t.pats, found: t.found,
    lateNights: t.lateNights, workHours: t.workMin / 60, musicHours: t.musicMin / 60, wishes: t.wishes, goals: t.goals, bond: soul.bond };
}

// a phrase to say a little later (a follow-up after a greeting, an achievement)
function queueSay(key, vars = {}, delay = 9000) {
  soul.queue.push({ key, vars, at: Date.now() + delay });
}

// ── the weather where you are (Astra's own weather place; Open-Meteo, no key; only its coordinates are sent) ──
async function weatherNow(now) {
  if (now - soul.weather.at < 30 * 60000) return soul.weather;
  soul.weather.at = now;
  try {
    const g = JSON.parse(import_node_fs.readFileSync(import_node_path.join(CFG, "settings.json"), "utf8")).general || {};
    if (!g.weather_location_lat && !g.weather_location_lon) return soul.weather;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(g.weather_location_lat).toFixed(3)}&longitude=${Number(g.weather_location_lon).toFixed(3)}&current=weather_code,temperature_2m`;
    const cur = (await (await fetch(url, { signal: AbortSignal.timeout(10000) })).json())?.current || {};
    const code = cur.weather_code;
    const kind = code >= 95 ? "storm" : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow"
      : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? "rain" : code <= 1 ? "clear" : "cloud";
    Object.assign(soul.weather, { kind, temp: Number(cur.temperature_2m) });
  } catch {}
  return soul.weather;
}

// ── the tone of your messages to Astra (only when allowed on the page; read here, sent nowhere) ──
var PRAISE = /(молодец|умниц|люблю тебя|спасибо|класс|лучшая|милая|красивая|хорошая|обожаю|good girl|love you|thank|great job|cute|best)/i;
var HURT = /(дура|тупая|глупая|ненавиж|бесишь|отстань|заткнись|бесполезн|stupid|shut up|hate you|useless|dumb)/i;

function chatMessagesSince() {
  const dir = import_node_path.join(CFG, "chat_history");
  const out = [];
  try {
    for (const f of import_node_fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
      const p = import_node_path.join(dir, f);
      const size = import_node_fs.statSync(p).size;
      const from = soul.chatPos[f];
      soul.chatPos[f] = size;
      if (from === undefined || size <= from) continue; // the first look only marks where the files end
      const fd = import_node_fs.openSync(p, "r");
      const buf = Buffer.alloc(size - from);
      import_node_fs.readSync(fd, buf, 0, buf.length, from);
      import_node_fs.closeSync(fd);
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        try {
          const m = JSON.parse(line);
          if (m.role === "user" && m.content) out.push(String(m.content));
        } catch {}
      }
    }
  } catch {}
  return out;
}

// ── a word written by Astra's AI (only for a plugin listed in the catalog: it needs Astra's chat) ──
async function aiWord(ctx, db, mood, hour) {
  const s = db.soul;
  if (typeof ctx.sendChatMessage !== "function") return "";
  const lang = langOf(s);
  const ask = lang === "ru"
    ? `Ты — ${s.character === "tsundere" ? "цундэрэ" : s.character} аниме-персонаж-компаньон на рабочем столе. Настроение: ${mood}. Время: ${hour}:00. Пользователь ${activity.proc ? `сейчас в программе ${activity.proc}` : "рядом"}. Скажи ему одну короткую живую фразу от себя (до 12 слов), без кавычек и пояснений.`
    : `You are a ${s.character} anime desktop companion. Mood: ${mood}. Time: ${hour}:00. The user is ${activity.proc ? `in ${activity.proc}` : "nearby"}. Say one short lively line to them (up to 12 words), no quotes, no explanations.`;
  let text = "";
  try {
    for await (const chunk of ctx.sendChatMessage(ask, { conversationId: "", voiceEnabled: false })) {
      const t = typeof chunk === "string" ? chunk : chunk?.text || chunk?.delta || chunk?.content || "";
      if (t) text += t;
      if (text.length > 300) break;
    }
  } catch (e) {
    soul.aiBlocked = String(e?.message || e).slice(0, 120);
    return "";
  }
  soul.aiBlocked = "";
  return text.replace(/^["«»\s]+|["«»\s]+$/g, "").split(/\n/)[0].slice(0, 160);
}

// ── the sound, the battery, the windows: a slow look every 20 s ──
var SYS_PS = `
Add-Type @'
using System; using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i(); int SetMasterVolumeLevel(float l, Guid c); int SetMasterVolumeLevelScalar(float l, Guid c);
  int GetMasterVolumeLevel(out float l); int GetMasterVolumeLevelScalar(out float l);
  int a(); int b(); int c(); int d(); int SetMute(bool m, Guid c2); int GetMute(out bool m);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
public class Sys {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint c);
  public static int Windows() { int n = 0; EnumWindows((h, l) => { if (IsWindowVisible(h) && GetWindowTextLength(h) > 0 && GetWindow(h, 4) == IntPtr.Zero) n++; return true; }, IntPtr.Zero); return n; }
  public static string Volume() {
    try {
      var e = (IMMDeviceEnumerator)(new MMDeviceEnumerator()); IMMDevice d; e.GetDefaultAudioEndpoint(0, 1, out d);
      var id = typeof(IAudioEndpointVolume).GUID; object o; d.Activate(ref id, 23, IntPtr.Zero, out o);
      var v = (IAudioEndpointVolume)o; float l; bool m; v.GetMasterVolumeLevelScalar(out l); v.GetMute(out m);
      return ((int)Math.Round(l * 100)) + "|" + (m ? 1 : 0);
    } catch { return "-1|0"; }
  }
}
'@
while ($true) {
  $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
  $bat = if ($b) { $b.EstimatedChargeRemaining } else { -1 }
  $ac = if ($b) { if ($b.BatteryStatus -eq 2 -or $b.BatteryStatus -ge 6) { 1 } else { 0 } } else { 1 }
  [Console]::Out.WriteLine("$([Sys]::Volume())|$bat|$ac|$([Sys]::Windows())"); [Console]::Out.Flush()
  Start-Sleep -Seconds 20
}`;
var sys = { vol: -1, mute: 0, bat: -1, ac: 1, wins: 0, seen: false };

function startSys() {
  const child = import_node_child_process.spawn("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SYS_PS], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  child.unref();
  child.stdout.unref?.();
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      const [vol, mute, bat, ac, wins] = line.trim().split("|").map(Number);
      if (Number.isFinite(vol)) sys = { vol, mute, bat, ac, wins, seen: true };
    }
  });
  child.on("exit", () => setTimeout(startSys, 30000).unref());
}

// ── her extra life, every tick; true when she did or said something ──
async function extrasTick(ctx, db, e) {
  const s = db.soul, { now, hour, day, here, free, have, play, today, min, mood } = e;
  const lang = langOf(s);
  const T = soul.totals;
  // needs and totals
  soul.hunger = clamp(soul.hunger + 0.08 * min);
  soul.restless = clamp(soul.restless + 0.4 * min);
  if (here) T.workMin += min;
  if (e.music) T.musicMin += min;
  // a new day: last night's late hours count, the habits of yesterday are kept
  if (soul.lastDay && soul.lastDay !== day) {
    const y = soul.diary[soul.lastDay];
    if (y && y.late > 30) T.lateNights++;
    if (soul.lastActive) soul.bedtimes[soul.lastDay] = lateHour(new Date(soul.lastActive));
  }
  soul.lastDay = day;
  if (here) soul.lastActive = now;
  // the weather pulls the mood a little
  if (s.weather) {
    const w = await weatherNow(now);
    if (w.kind === "rain") soul.joy = clamp(soul.joy - 0.1 * min);
    if (w.kind === "storm") soul.joy = clamp(soul.joy - 0.2 * min);
    if (w.kind === "snow") soul.joy = clamp(soul.joy + 0.1 * min);
    if (w.kind === "clear") soul.energy = clamp(soul.energy + 0.05 * min);
  }
  // her words that were waiting
  const due = soul.queue.find((q) => q.at <= now);
  if (due && here) {
    soul.queue = soul.queue.filter((q) => q !== due);
    await say(ctx, db, due.key, { force: true, vars: due.vars });
    return true;
  }
  soul.queue = soul.queue.filter((q) => now - q.at < 10 * 60000);

  // achievements and friendship levels
  const tot = totalsOf();
  for (const a of ACHIEVEMENTS) {
    if (soul.ach[a.id] || !a.need(tot)) continue;
    soul.ach[a.id] = day;
    queueSay("achievement", { title: a[lang] || a.en }, 3000);
  }
  const lv = friendship(soul.bond, lang);
  if (lv.index > soul.level) {
    soul.level = lv.index;
    queueSay("levelUp", { level: lv.name }, 5000);
  }

  // a call: a microphone held for an hour, then let go
  if (activity.mic) soul.callFrom ||= now;
  else if (soul.callFrom) {
    const long = now - soul.callFrom > 60 * 60000;
    soul.callFrom = 0;
    if (long) queueSay("callEnd", {}, 4000);
  }

  // sulking: lonely and unnoticed for 45 minutes while you are here
  const noticed = e.attention;
  if (noticed || !soul.noticedAt) soul.noticedAt = now;
  if (soul.sulk) {
    if (noticed) {
      soul.sulk = false;
      Object.assign(soul, { joy: clamp(soul.joy + 20), bond: clamp(soul.bond + 1), social: clamp(soul.social + 20) });
      const h = stateFor({ names: ["as_lively_heart", "shy", "heart"] }, have);
      if (h && free) await play(h);
      await say(ctx, db, "sulkMakeup", { force: true });
      return true;
    }
    if (free && now - soul.sulkAt > 10 * 60000) {
      soul.sulkAt = now;
      const sad = stateFor({ names: ["fold_arms", "sad", "sigh"] }, have);
      if (sad) await play(sad);
    }
    return true; // a sulking girl does nothing else
  }
  if (here && soul.social < 20 && now - (soul.noticedAt || now) > 45 * 60000 && free) {
    Object.assign(soul, { sulk: true, sulkAt: now });
    const sad = stateFor({ names: ["fold_arms", "sad", "sigh"] }, have);
    if (sad) await play(sad);
    await say(ctx, db, "sulk", { force: true });
    return true;
  }

  // wishes: granted by what she asked for
  if (soul.wish) {
    const w = soul.wish;
    const done = (w.kind === "pat" && e.pat) || (w.kind === "music" && e.music) || (w.kind === "play" && e.played) || (w.kind === "talk" && e.chat);
    if (done) {
      soul.wish = null;
      T.wishes++;
      Object.assign(soul, { joy: clamp(soul.joy + 20), bond: clamp(soul.bond + 2) });
      const y = stateFor({ names: ["as_lively_yay", "excited", "clap", "yay"] }, have);
      if (y && free) await play(y);
      await say(ctx, db, "wishDone", { force: true });
      return true;
    }
    if (now > w.until) soul.wish = null;
  }

  // the tone of your messages to Astra
  if (s.chatTone) {
    for (const msg of chatMessagesSince()) {
      e.chat = true;
      if (soul.planAsked && !soul.plan && now - soul.planAsked < 30 * 60000) Object.assign(soul, { plan: msg.trim().slice(0, 80), planDay: day });
      if (now - (soul.toneAt || 0) < 10 * 60000) continue;
      const good = PRAISE.test(msg), bad = HURT.test(msg);
      if (!good && !bad) continue;
      soul.toneAt = now;
      if (good) Object.assign(soul, { joy: clamp(soul.joy + 15), bond: clamp(soul.bond + 1) });
      else Object.assign(soul, { joy: clamp(soul.joy - 20) });
      const r = stateFor({ names: good ? ["as_lively_heart", "shy", "heart"] : ["sad", "sigh"] }, have);
      if (r && free) await play(r);
      await say(ctx, db, good ? "praised" : "hurt", { force: true });
      return true;
    }
  } else soul.chatPos = {};

  if (!free) return false;

  // the goal for today
  if (s.goalHours > 0) {
    const g = soul.goalSaid[day] || 0, need = s.goalHours * 60;
    if (g < 2 && today.work >= need) {
      soul.goalSaid[day] = 2;
      T.goals++;
      const y = stateFor({ names: ["as_lively_yay", "celebrate", "clap"] }, have);
      if (y) await play(y);
      await say(ctx, db, "goalDone", { force: true });
      return true;
    }
    if (g < 1 && today.work >= need / 2) {
      soul.goalSaid[day] = 1;
      await say(ctx, db, "goalHalf", { force: true });
      return true;
    }
  }

  // the tomato timer
  const P = s.pomodoro;
  if (P?.on) {
    if (!here && now - soul.lastHere > 15 * 60000) soul.pomo = null;
    else if (here && !soul.pomo) {
      soul.pomo = { phase: "work", until: now + P.work * 60000 };
      await say(ctx, db, "pomoStart", { force: true });
      return true;
    } else if (soul.pomo && now >= soul.pomo.until) {
      const work = soul.pomo.phase === "work";
      soul.pomo = { phase: work ? "rest" : "work", until: now + (work ? P.rest : P.work) * 60000 };
      if (work) {
        const t = stateFor({ names: ["stretch", "stretching"] }, have);
        if (t) await play(t);
      }
      await say(ctx, db, work ? "pomoBreak" : "pomoBack", { force: true });
      return true;
    }
  } else soul.pomo = null;

  // care: water and your eyes, every hour and a half or so
  if (s.care && here && soul.activeSince && now - soul.careAt > minutes(75, 100) && now - soul.activeSince > 45 * 60000) {
    soul.careAt = now;
    soul.careKind = soul.careKind === "water" ? "eyes" : "water";
    await say(ctx, db, soul.careKind, { force: true });
    return true;
  }

  // your programs: a word when you have been in one kind for three minutes (once in two hours each)
  const kind = appKindOf(activity.proc);
  if (kind !== soul.app.kind) soul.app = { kind, since: now };
  for (const r of (s.appRules || [])) {
    if (!r?.match || !r?.text || !activity.proc.includes(String(r.match).toLowerCase())) continue;
    const k = `rule:${r.match}`;
    if (here && now - (soul.appSeen[k] || 0) > 2 * 3600000) {
      soul.appSeen[k] = now;
      if (s.talk && !quietNow(s)) await ctx.fireTrigger("anim_say", { text: r.text }).catch(() => {});
      return true;
    }
  }
  if (s.apps && kind && here && now - soul.app.since > 3 * 60000 && now - (soul.appSeen[kind] || 0) > 2 * 3600000) {
    soul.appSeen[kind] = now;
    if (await say(ctx, db, `app_${kind}`)) return true;
  }
  // watching a video together: a browser or a player, and nothing touched for three minutes
  if ((kind === "video" || kind === "browser") && activity.idleSec > 180 && activity.idleSec < 290 && now - soul.watchAt > 45 * 60000) {
    soul.watchAt = now;
    const t = stateFor({ names: ["think", "thinking"] }, have);
    if (t) await play(t);
    await say(ctx, db, "watching", { force: true });
    return true;
  }

  // the sound and the battery
  if (sys.seen) {
    if (sys.mute && !soul.wasMuted && here) {
      soul.wasMuted = true;
      await say(ctx, db, "silence");
      return true;
    }
    if (!sys.mute) soul.wasMuted = false;
    if (sys.vol >= 90 && e.music && now - soul.loudAt > 2 * 3600000) {
      soul.loudAt = now;
      await say(ctx, db, "loud", { force: true });
      return true;
    }
    if (sys.bat >= 0 && sys.bat < 20 && !sys.ac && now - soul.batAt > 30 * 60000) {
      soul.batAt = now;
      soul.batLow = true;
      const y = stateFor({ names: ["yawn", "sleepy"] }, have);
      if (y) await play(y);
      await say(ctx, db, "batteryLow", { force: true });
      return true;
    }
    if (soul.batLow && sys.ac) {
      soul.batLow = false;
      await say(ctx, db, "batteryOk", { force: true });
      return true;
    }
    if (hour >= 21 && sys.wins >= 12 && soul.cleanupDay !== day && here) {
      soul.cleanupDay = day;
      await say(ctx, db, "cleanup", { force: true });
      return true;
    }
  }

  // the weather, once a kind (and the cold, the heat)
  if (s.weather && here && soul.weather.kind && soul.weatherSaid !== `${day}:${soul.weather.kind}`) {
    const w = soul.weather;
    const key = w.temp <= -5 ? "weatherCold" : w.temp >= 28 ? "weatherHot"
      : { rain: "weatherRain", snow: "weatherSnow", clear: "weatherSun", storm: "weatherStorm" }[w.kind];
    soul.weatherSaid = `${day}:${w.kind}`;
    if (key && (await say(ctx, db, key))) return true;
  }

  // near your usual bedtime
  const beds = Object.values(soul.bedtimes).slice(-7);
  const bed = beds.length >= 3 ? median(beds) : null;
  const nowH = lateHour(new Date(now));
  if (bed && here && Math.abs(nowH - bed) < 0.34 && soul.bedSaid !== day) {
    soul.bedSaid = day;
    soul.energy = clamp(soul.energy - 10);
    const y = stateFor({ names: ["yawn", "sleepy"] }, have);
    if (y) await play(y);
    await say(ctx, db, "bedtimeHint", { force: true });
    return true;
  }

  // the morning plan, and in the evening: did it work out?
  if (here && hour >= 9 && hour < 12 && soul.planAskedDay !== day && s.questions) {
    soul.planAskedDay = day;
    soul.planAsked = now;
    if (soul.planDay !== day) soul.plan = "";
    await say(ctx, db, "plan", { force: true });
    return true;
  }
  const plan = soul.planDay === day ? soul.plan : s.planDay === day ? s.plan : "";
  if (plan && here && hour >= 19 && hour < 23 && soul.planCheckDay !== day) {
    soul.planCheckDay = day;
    await say(ctx, db, "planCheck", { force: true, vars: { plan } });
    return true;
  }

  // a hobby for a few days
  if (!soul.hobby || now - soul.hobby.since > minutes(2 * 1440, 3 * 1440)) {
    const kinds = Object.keys(HOBBIES).filter((k) => k !== soul.hobby?.kind);
    soul.hobby = { kind: pick(kinds), since: now };
    if (here) {
      await say(ctx, db, "hobbyNew", { force: true, vars: { hobby: HOBBIES[soul.hobby.kind][lang] || HOBBIES[soul.hobby.kind].en } });
      return true;
    }
  }
  if (here && soul.hobbyDay !== day && Math.random() < 0.02) {
    soul.hobbyDay = day;
    if (await say(ctx, db, `hobby_${soul.hobby.kind}`)) return true;
  }

  // a wish now and then
  if (here && !soul.wish && mood !== "sleepy" && now - soul.wishAt > minutes(120, 200)) {
    soul.wishAt = now;
    const kinds = ["pat", "talk", ...(s.play ? ["play"] : []), ...(e.music ? [] : ["music"])];
    soul.wish = { kind: pick(kinds), until: now + 20 * 60000 };
    await say(ctx, db, `wish_${soul.wish.kind}`, { force: true });
    return true;
  }

  // a gift every few days
  if (here && now - soul.giftAt > minutes(2 * 1440, 4 * 1440)) {
    soul.giftAt = now;
    const list = GIFTS[lang] || GIFTS.en;
    soul.gifts.unshift({ day, text: pick(list) });
    soul.gifts = soul.gifts.slice(0, 30);
    const h = stateFor({ names: ["as_lively_heart", "heart", "shy"] }, have);
    if (h) await play(h);
    await say(ctx, db, "gift", { force: true });
    return true;
  }

  // a word by Astra's AI, once in two hours (when allowed and listed)
  if (s.aiWords && here && now - soul.aiAt > 2 * 3600000 && !quietNow(s)) {
    soul.aiAt = now;
    const text = await aiWord(ctx, db, mood, hour);
    if (text && s.talk) {
      await ctx.fireTrigger(voiceTrigger(s, mood), { text }).catch(() => {});
      return true;
    }
  }
  return false;
}

// the greeting for a day: a date, yesterday, a habit, the day of the week — or just morning / back
function greetingKey(s, base, now, day, hour) {
  const d = new Date(now), md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (base === "missed") return { key: "missed" };
  if (soul.greetDay === day) return { key: base };
  soul.greetDay = day;
  if (md === "12-31" || md === "01-01") return { key: "newYear" };
  if (s.birthday && md === s.birthday) return { key: "birthday" };
  if (md === "10-31") return { key: "halloween" };
  if (md === "02-14") return { key: "valentine" };
  if (md === "03-08") return { key: "womensDay" };
  if (soul.firstDay) {
    const f = new Date(soul.firstDay);
    const months = (d.getFullYear() - f.getFullYear()) * 12 + d.getMonth() - f.getMonth();
    if (months > 0 && d.getDate() === f.getDate()) return months % 12 === 0 ? { key: "anniversaryYear" } : { key: "anniversaryMonth", vars: { months } };
  }
  const arrivals = Object.values(soul.arrivals).slice(-7);
  const usual = arrivals.length >= 3 ? median(arrivals) : null;
  soul.arrivals[day] = hour + d.getMinutes() / 60;
  const days = Object.keys(soul.arrivals).sort();
  while (days.length > 21) delete soul.arrivals[days.shift()];
  if (usual !== null && hour + d.getMinutes() / 60 - usual > 1.5) return { key: "waited" };
  return { key: base, follow: true };
}

// what comes after a morning greeting: yesterday, a dream, the day of the week, the season
function morningFollowUps(day, now) {
  const d = new Date(now);
  const y = new Date(now - 86400000), yk = dayKey(y);
  const yd = soul.diary[yk];
  if (yd?.late > 30) queueSay("yesterdayLate", {}, 8000);
  else if (yd && yd.pats >= 5) queueSay("yesterdayFun", {}, 8000);
  if (Math.random() < 0.35) queueSay("dream", {}, 25000);
  const wd = d.getDay();
  if (wd === 1) queueSay("monday", {}, 45000);
  else if (wd === 5) queueSay("friday", {}, 45000);
  else if ((wd === 0 || wd === 6) && Math.random() < 0.6) queueSay("weekend", {}, 45000);
  else if (Math.random() < 0.15) queueSay(["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][d.getMonth()], {}, 45000);
}

// ── things she holds and things around her: a block of her own in her pack ─────────
// A book, a cup, a plush bear in her hands (her pastimes "reads", "tea", "hugs") and the sky of the hour around her: sparkles in the morning, fireflies in the evening, stars
// at night. Like Anim Studio's faces and work panels: props and effects in the worn character's own
// pack between two marker lines, the effects added to the pack's hub; the pack is read when the
// avatar starts, so a change (or a new part of the day) waits until nobody has touched the computer
// for a minute and restarts the avatar.
var LIFE_BEGIN = "# ── Companion Life: things she holds and things around her (written by the plugin) ──";
var LIFE_END = "# ── end of Companion Life ──";
var LIFE_DIR = "clips/companion-life";
var LIFE_FILES = { "book.glb": BOOK_GLB, "cup.glb": CUP_GLB, "plush.glb": PLUSH_GLB, "hold.vrma": HOLD_VRMA, "hug.vrma": HUG_VRMA, "star.png": STAR_PNG, "firefly.png": FIREFLY_PNG };
// her own holding poses (tools/gen_hold.cjs): forearms forward, palms toward the thing; the thing is
// placed between her hands with no fingertip grip (that one turns the palms down, for typing)
var HOLD = { cl_read: { prop: "book.glb", pose: "hold", place: [0.42, 0.3, 45, 0.85] },
  cl_tea: { prop: "cup.glb", pose: "hold", place: [0.4, 0.31, 0, 1.2] },
  cl_hug: { prop: "plush.glb", pose: "hug", place: [0.3, 0.27, 0, 1.2] } };
// things in her hands are not ready yet: kept here, never written into her pack until this is true
var PROPS_READY = false;
var skyPeriod = (h) => (h >= 5 && h < 11 ? "morning" : h >= 18 && h < 22 ? "evening" : h >= 22 || h < 5 ? "night" : "");

function tomlTable(text, name) {
  const head = new RegExp(`^\\[${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\][ \\t]*(#[^\\r\\n]*)?$`, "m").exec(text);
  if (!head) return "";
  const from = head.index + head[0].length, next = text.slice(from).search(/^\[/m);
  return text.slice(head.index, next < 0 ? text.length : from + next);
}
var hubOf = (text) => /^\s*clip\s*=\s*"([^"]+)"/m.exec(tomlTable(text, "interactions.none"))?.[1] || "";
function idleClipOf(text) {
  const head = /^\[states\.idle\][ \t]*(#[^\r\n]*)?$/m.exec(text);
  if (!head) return "";
  const rest = text.slice(head.index + head[0].length);
  const end = rest.search(/^\[(?!\[?states\.idle\.)/m);
  return /^\s*clip\s*=\s*"([^"]+)"/m.exec(end < 0 ? rest : rest.slice(0, end))?.[1] || "";
}

// the block for this pack, the hour and the switches; "" when nothing is asked for or the pack has no hub
function lifeBlock(text, s, hour) {
  const hub = hubOf(text), idle = idleClipOf(text);
  if (!hub || !idle) return { rows: "", names: [] };
  const has = (st) => new RegExp(`^\\[states\\.${st}\\]`, "m").test(text);
  const L = [], names = [];
  const calm = ["idle", "cl_read", "cl_tea", "cl_hug", "as_sleep", "sit"].filter((x) => x.startsWith("cl_") ? s.props : has(x));
  if (s.props) {
    for (const pose of ["hold", "hug"]) L.push("[[clips]]", `name = "cl_${pose}"`, `file = "${LIFE_DIR}/${pose}.vrma"`, "fade = 0.8", "");
    for (const [st, h] of Object.entries(HOLD)) {
      const [fwd, down, tilt, scale] = h.place;
      L.push("[[props]]", `name = "${st}"`, `file = "${LIFE_DIR}/${h.prop}"`, "",
        `[states.${st}]`, `clip = "cl_${h.pose}"`, "loop = true");
      if (has("drag")) L.push(`[[states.${st}.transitions]]`, 'on = "dragged"', 'to = "drag"');
      if (has("as_work")) L.push(`[[states.${st}.transitions]]`, 'on = "action_start"', 'to = "as_work"');
      L.push(`[[states.${st}.transitions]]`, 'on = "idle_timeout"', 'to = "idle"', "",
        // it comes in once her hands are there, and goes before they drop
        `[effects.${st}]`, 'kind = "contacts"', `prop = "${st}"`, `pet_states = ["${st}"]`, "fade_in = 0.9", "fade_out = 0.4",
        `[effects.${st}.place]`, `forward = ${fwd.toFixed(2)}`, `down = ${down.toFixed(2)}`, `tilt = ${tilt.toFixed(1)}`, "ref_arm = 0.45", `scale = ${scale.toFixed(2)}`, "follow = 1.0",
        `[effects.${st}.contacts]`, "");
      names.push(st);
    }
  }
  const period = s.sky ? skyPeriod(hour) : "";
  if (period) {
    const sky = { morning: { prop: "builtin:nayu-anims/sparkle.png", rate: "[0.8, 1.2]", size: "[0.04, 0.06]", area: "[0.5, 0.4]", rise: "0.05", life: "[1.0, 1.6]" },
      evening: { prop: `${LIFE_DIR}/firefly.png`, rate: "[0.6, 1.0]", size: "[0.03, 0.05]", area: "[0.6, 0.7]", rise: "0.03", life: "[2.0, 3.0]" },
      night: { prop: `${LIFE_DIR}/star.png`, rate: "[0.5, 0.8]", size: "[0.04, 0.07]", area: "[0.6, 0.25]", rise: "0.01", life: "[2.5, 3.5]" } }[period];
    L.push("[[props]]", 'name = "cl_sky"', `file = "${sky.prop}"`, "",
      "[effects.cl_sky]", 'kind = "emit"', 'prop = "cl_sky"', `pet_states = [${calm.map((x) => `"${x}"`).join(", ")}]`, "fade_in = 1.0", "fade_out = 1.0",
      "[effects.cl_sky.emit]", 'bone = "head"', 'axes = "view"', 'shape = "box"', `offset = [0.0, ${period === "night" ? "0.22" : "0.0"}, 0.1]`, `area = ${sky.area}`,
      `rate = ${sky.rate}`, "burst = 1", "max = 8", `life = ${sky.life}`, "speed = [0.0, 0.01]", `rise = ${sky.rise}`, "drag = 0.5",
      `size = ${sky.size}`, "pop = 0.2", "fade = 0.5", "tilt = [-20.0, 20.0]", "sway = 8.0", "sway_hz = 0.6", "");
    names.push("cl_sky");
  }
  return { rows: L.join("\n"), names, hub };
}

// her pack with the block as it should be now; the files it names written beside it
function writeLifeBlock(s, hour = new Date().getHours()) {
  const f = basePackFile();
  if (!f) return false;
  let text = import_node_fs.readFileSync(f, "utf8");
  const b = text.indexOf(LIFE_BEGIN);
  if (b >= 0) {
    const e = text.indexOf(LIFE_END, b);
    text = text.slice(0, b).replace(/\n+$/, "\n") + (e >= 0 ? text.slice(e + LIFE_END.length).replace(/^\n+/, "") : "");
  }
  const { rows, names, hub } = lifeBlock(text, { ...s, props: s.props && PROPS_READY }, hour);
  // the hub brings our effects along (ours replaced, everyone else's kept)
  if (hub) {
    const head = new RegExp(`^\\[effects\\.${hub}\\][ \\t]*$`, "m").exec(text);
    if (head) {
      const from = head.index + head[0].length, next = text.slice(from).search(/^\[/m), until = next < 0 ? text.length : from + next;
      let table = text.slice(from, until);
      const w = /^with\s*=\s*\[([^\]\n]*)\][ \t]*$/m.exec(table);
      const kept = w ? [...w[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((n) => !n.startsWith("cl_")) : [];
      const all = [...kept, ...names];
      const line = all.length ? `with = [${all.map((n) => JSON.stringify(n)).join(", ")}]` : "";
      if (w) table = line ? table.replace(w[0], line) : table.replace(w[0] + "\n", "");
      else if (line) table = `\n${line}${table}`;
      text = text.slice(0, from) + table + text.slice(until);
    }
  }
  if (rows) {
    const dir = import_node_path.join(import_node_path.dirname(f), ...LIFE_DIR.split("/"));
    import_node_fs.mkdirSync(dir, { recursive: true });
    // only the files the block names
    for (const [n, data] of Object.entries(LIFE_FILES)) {
      if (!rows.includes(`${LIFE_DIR}/${n}`)) continue;
      const p = import_node_path.join(dir, n);
      if (!import_node_fs.existsSync(p) || import_node_fs.statSync(p).size !== data.length) import_node_fs.writeFileSync(p, data);
    }
    text = `${text.replace(/\n+$/, "\n")}\n${LIFE_BEGIN}\n${rows}\n${LIFE_END}\n`;
  }
  const before = import_node_fs.readFileSync(f, "utf8");
  if (before === text) return false;
  if (!import_node_fs.existsSync(f + ".before-companion-life")) import_node_fs.copyFileSync(f, f + ".before-companion-life");
  import_node_fs.writeFileSync(f, text);
  return true;
}

// the pack is read when the avatar starts: a change waits for a quiet minute, then a restart
var lifePack = { pending: false, period: null, checkedAt: 0 };
async function restartAvatar() {
  await new Promise((r) => import_node_child_process.execFile("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "Stop-Process -Name astra-avatar-engine -Force -ErrorAction SilentlyContinue"], { windowsHide: true }, () => r()));
  soul.packStates = null;
}
async function lifePackTick(s, now, hour) {
  if (now - lifePack.checkedAt < 60000 && !lifePack.pending) return;
  lifePack.checkedAt = now;
  const period = s.sky ? skyPeriod(hour) : "";
  if (lifePack.period !== period || lifePack.dirty) {
    lifePack.dirty = false;
    lifePack.period = period;
    try {
      if (writeLifeBlock(s, hour)) lifePack.pending = true;
    } catch {}
  }
  if (lifePack.pending && activity.seen && activity.idleSec >= 60 && standing()) {
    lifePack.pending = false;
    await restartAvatar();
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
  if (!soul.firstDay) Object.assign(soul, { firstDay: day, giftAt: now, wishAt: now });
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
  // her hobby and her restlessness make some pastimes likelier; hunger opens a snack any time
  const boost = { ...(soul.hobby ? HOBBIES[soul.hobby.kind]?.pastimes : {}) };
  if (soul.restless > 70) for (const k of ["spin", "peek", "stretch", "yay"]) boost[k] = (boost[k] || 1) * 2;
  const c = { hour, day, music, here, away, near: activity.over >= 10, asleep: dozing.on, snacks: soul.snacks, hungry: soul.hunger > 75, boost };
  driftSoul(soul, min, c, pers);
  if (ev.pat) {
    Object.assign(soul, { joy: clamp(soul.joy + 15), social: clamp(soul.social + 20), boredom: clamp(soul.boredom - 20), bond: clamp(soul.bond + 0.5 * ev.pat) });
    today.pats += ev.pat;
    soul.totals.pats += ev.pat;
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
  if (soul.holding && now > soul.holding) {
    soul.holding = null;
    if (standing(st)) await ctx.fireTrigger("anim_play", { state: "idle" }).catch(() => {});
  }
  // the block in her pack (things in her hands, the kitten, the sky of the hour)
  lifePackTick(s, now, hour).catch(() => {});

  // ── you came back, the first time today, after hours, after days ──
  if (activity.idleSec >= AWAY_SEC && !soul.wasAway) Object.assign(soul, { wasAway: true, awayFrom: now - activity.idleSec * 1000 });
  if (here && activity.idleSec < 5) {
    const gone = soul.wasAway ? now - soul.awayFrom : soul.lastHere ? now - soul.lastHere : 0;
    const first = soul.morningDay !== day && hour >= 5;
    if (soul.wasAway || first) {
      soul.wasAway = false;
      Object.assign(soul, { joy: clamp(soul.joy + 20), social: clamp(soul.social + 15) });
      const days = Math.floor(gone / 86400000);
      const base = days >= 2 ? "missed" : first && hour < 12 ? "morning" : gone > 3 * 3600000 ? "backLong" : "back";
      if (first) soul.morningDay = day;
      const g = first ? greetingKey(s, base, now, day, hour) : { key: base };
      if (free) {
        const wave = stateFor({ names: ["hello", "wave", "greeting"] }, have);
        if (wave) await play(wave);
      }
      await say(ctx, db, g.key, { force: true, vars: { days, ...g.vars } });
      if (first && hour < 13) morningFollowUps(day, now);
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
    const long = soul.gameLast - soul.gameFrom > 10 * 60000, veryLong = soul.gameLast - soul.gameFrom > 2 * 3600000;
    soul.gameFrom = 0;
    if (long) {
      today.games++;
      soul.boredom = clamp(soul.boredom - 15);
      if (s.games && free) {
        const r = stateFor({ names: Math.random() < 0.5 ? ["as_lively_yay", "excited", "clap"] : ["hello", "wave", "thankful"] }, have);
        if (r) await play(r);
        await say(ctx, db, veryLong ? "gameJealous" : "gameEnd", { force: true });
        return;
      }
    }
  }

  // ── quiet time: nothing of her own until it is over ──
  if (s.dndUntil > now) return;
  // ── the rest of her life ──
  const attention = ev.pat > 0 || activity.over >= 8 || ev.work > 0;
  const extra = await extrasTick(ctx, db, { now, hour, day, here, free, have, play, today, min, mood: moodOf(soul, hour), music,
    attention, pat: ev.pat > 0, played: soul.played, chat: ev.work > 0 });
  soul.played = false;
  if (extra || soul.sulk) return;

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
  if (here && soul.bond >= 45 && now - soul.affectionAt > 3 * 3600000 && Math.random() < 0.3) {
    soul.affectionAt = now;
    const h = stateFor({ names: ["as_lively_heart", "heart", "shy"] }, have);
    if (h) await play(h);
    await say(ctx, db, "affection", { force: true });
    return;
  }

  if (soul.hunger > 80 && !(soul.cool.hungry > now)) {
    soul.cool.hungry = now + 3 * 3600000;
    queueSay("hungry", {}, 2000);
  } else if (soul.restless > 85 && !(soul.cool.restless > now)) {
    soul.cool.restless = now + 2 * 3600000;
    queueSay("restless", {}, 2000);
  }
  const p = pickPastime(mood, c, have, soul.cool, now, Math.random, pers);
  if (!p) return;
  soul.cool[p.id] = now + minutes(12, 25);
  if (p.snack) soul.snacks.push(`${day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`);
  soul.boredom = clamp(soul.boredom - 25);
  soul.restless = clamp(soul.restless - (["spin", "peek", "stretch", "yay"].includes(p.id) ? 50 : 15));
  if (p.snack) soul.hunger = clamp(soul.hunger - 60);
  if (p.hold) soul.holding = now + minutes(0.4, 0.8);
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
var COMMAND_TRIGGERS = ["anim_play", "anim_say", "anim_say_soft", "anim_say_bright"];

function commandSpecs(ru) {
  return [
    { trigger: "anim_play", name: ru ? "Companion Life: занятие" : "Companion Life: a pastime",
      action: { mode: "state", state: "{state}", trigger: "", type: "companion_animation" } },
    { trigger: "anim_say", name: ru ? "Companion Life: сказать" : "Companion Life: say",
      action: { text: "{text}", tts_pitch: 1, tts_speed: 0.85, type: "speak", use_settings_voice: false, voices: {} } },
    // the voice for the mood: softer and slower when sleepy or lonely, brighter when happy
    { trigger: "anim_say_soft", name: ru ? "Companion Life: сказать тихо" : "Companion Life: say softly",
      action: { text: "{text}", tts_pitch: 0.96, tts_speed: 0.75, type: "speak", use_settings_voice: false, voices: {} } },
    { trigger: "anim_say_bright", name: ru ? "Companion Life: сказать бодро" : "Companion Life: say brightly",
      action: { text: "{text}", tts_pitch: 1.07, tts_speed: 0.95, type: "speak", use_settings_voice: false, voices: {} } }
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
  const lang = langOf(db.soul);
  const lv = friendship(soul.bond, lang);
  return { soul: { ...db.soul, now: soulNow() }, commands: commandsStatus(ctx), character: activeCharacter(), ownPack: !!basePackFile(),
    characters: CHARACTERS, langs: LANGS, diary: diaryList(db),
    pastimes: PASTIMES.map((p) => ({ id: p.id, state: stateFor(p, have) })),
    level: { ...lv, next: LEVELS[lv.index + 1]?.min ?? null, levels: LEVELS.map((l) => l[lang] || l.en) },
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, title: a[lang] || a.en, at: soul.ach[a.id] || "" })),
    gifts: soul.gifts, totals: totalsOf(), hunger: Math.round(soul.hunger), restless: Math.round(soul.restless),
    hobby: soul.hobby ? HOBBIES[soul.hobby.kind]?.[lang] || soul.hobby.kind : "", wish: soul.wish?.kind || "", sulk: soul.sulk,
    pomo: soul.pomo, weather: soul.weather, sys, plan: soul.planDay === dayKey() ? soul.plan : "", aiBlocked: soul.aiBlocked,
    canAi: typeof ctx?.sendChatMessage === "function", packPending: lifePack.pending,
    keys: Object.keys(PHRASES.ru), usual: { arrive: median(Object.values(soul.arrivals).slice(-7)), bed: median(Object.values(soul.bedtimes).slice(-7)) } };
}

// settings worth sharing: her character, her words, your rules (not her memories)
var SHARED = ["character", "name", "custom", "appRules", "quiet", "pomodoro", "lang", "voiceMood", "props", "sky"];

export const app = plugin({
  id: "companion-life",
  tools: {
    companion_quiet: tool({
      description: "Companion Life: keep the avatar quiet and still for a while (no pastimes, no words) — when the user asks her not to disturb. Не мешать: тишина на N минут.",
      input: schema.object({ minutes: schema.number().describe("how long, minutes (0 ends it)") }),
      run: async ({ minutes: m }) => {
        const st = loadDb().soul;
        st.dndUntil = Number(m) > 0 ? Date.now() + Math.min(600, Number(m)) * 60000 : 0;
        saveSettings(st);
        return st.dndUntil ? `quiet until ${new Date(st.dndUntil).toLocaleTimeString()}` : "quiet time over";
      }
    }),
    companion_mood: tool({
      description: "Companion Life: how the avatar feels now — her mood, needs, attachment level, hobby, today's diary. Как она себя чувствует.",
      input: schema.object({}),
      run: async () => JSON.stringify({ ...soulNow(), level: friendship(soul.bond, langOf(loadDb().soul)).name,
        hobby: soul.hobby?.kind || "", wish: soul.wish?.kind || "", sulk: soul.sulk })
    })
  },
  triggers: {
    anim_play: { label: "Companion Life: the avatar plays a state ({state})", fields: [] },
    anim_say: { label: "Companion Life: a phrase to say ({text})", fields: [] },
    anim_say_soft: { label: "Companion Life: a phrase to say softly ({text})", fields: [] },
    anim_say_bright: { label: "Companion Life: a phrase to say brightly ({text})", fields: [] }
  },
  onStart: async (ctx) => {
    ctxLang = ctx.language || "ru";
    startWatch(ctx);
    startSys();
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
        for (const k of ["on", "talk", "calls", "games", "questions", "play", "setup", "weather", "apps", "voiceMood", "care", "chatTone", "aiWords"]) if (k in patch) s[k] = !!patch[k];
        // the block in her pack: a change is written at once and the avatar restarts at the next quiet minute
        for (const k of ["props", "sky"]) if (k in patch) {
          s[k] = !!patch[k];
          lifePack.dirty = true;
          lifePack.checkedAt = 0;
        }
        if ("lang" in patch && ["auto", ...LANGS].includes(patch.lang)) s.lang = patch.lang;
        if ("goalHours" in patch) s.goalHours = Math.max(0, Math.min(16, Number(patch.goalHours) || 0));
        if ("birthday" in patch) s.birthday = /^\d{2}-\d{2}$/.test(String(patch.birthday)) ? String(patch.birthday) : "";
        if ("plan" in patch) Object.assign(s, { plan: String(patch.plan || "").trim().slice(0, 80), planDay: dayKey() });
        if (patch.pomodoro) {
          if ("on" in patch.pomodoro) s.pomodoro.on = !!patch.pomodoro.on;
          if ("work" in patch.pomodoro) s.pomodoro.work = Math.max(5, Math.min(120, Number(patch.pomodoro.work) || 25));
          if ("rest" in patch.pomodoro) s.pomodoro.rest = Math.max(1, Math.min(60, Number(patch.pomodoro.rest) || 5));
        }
        if (Array.isArray(patch.appRules)) s.appRules = patch.appRules.filter((r) => r?.match && r?.text).map((r) => ({ match: String(r.match).slice(0, 60), text: String(r.text).slice(0, 200) })).slice(0, 50);
        if (patch.custom && typeof patch.custom === "object") {
          s.custom = {};
          for (const [k, v] of Object.entries(patch.custom)) {
            const list = (Array.isArray(v) ? v : String(v).split(/\r?\n/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
            if (list.length && PHRASES.ru[k]) s.custom[k] = list;
          }
        }
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
      // quiet time from the page (minutes; 0 ends it)
      quiet: async (p) => {
        const st = loadDb().soul;
        st.dndUntil = Number(p.minutes) > 0 ? Date.now() + Math.min(600, Number(p.minutes)) * 60000 : 0;
        saveSettings(st);
        return st.dndUntil;
      },
      exportSettings: async () => {
        const st = loadDb().soul;
        return JSON.stringify(Object.fromEntries(SHARED.map((k) => [k, st[k]])), null, 2);
      },
      importSettings: async (p) => {
        const data = JSON.parse(String(p.json || "{}"));
        const st = loadDb().soul;
        for (const k of SHARED) if (k in data) st[k] = data[k];
        saveSettings(st);
        lifePack.dirty = true;
        return true;
      },
      // write the block into her pack now and restart the avatar
      applyPack: async () => {
        const changed = writeLifeBlock(loadDb().soul);
        lifePack.pending = false;
        await restartAvatar();
        return { changed };
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
        const text = phraseFor(langOf(s), String(p.key || "pat"), s.character, { name: s.name, days: 3, hour: 2, hours: "2 ч",
          work: "3 ч", pats: 5, naps: 1, music: "40 мин", games: 2, months: 1, hobby: "пение", title: "Неделя вместе", level: "друзья", plan: "доделать проект" },
          Math.random, s.custom?.[String(p.key || "pat")]);
        if (text) await ctx.fireTrigger("anim_say", { text }).catch(() => {});
        return text;
      },
      createCommands: async (_p, ctx) => createCommands(ctx)
    }
  },
  healthCheck: () => ({ healthy: true, status: "ok" })
});
// for test/*.test.mjs
export const internals = { PROPS_READY, moodOf, driftSoul, pickPastime, stateFor, bondAfterAbsence, quietNow, PASTIMES, PHRASES, CHARACTERS, phraseFor,
  standing, soul, soulNow, soulTick, diaryToday, spanText, PERSONALITIES, activity: () => activity, appKindOf, friendship, greetingKey, lifeBlock,
  writeLifeBlock, voiceTrigger, langOf, ACHIEVEMENTS, LEVELS, HOBBIES, GIFTS, totalsOf, lateHour, median };
if (require.main === module) app.run();
