// @ts-nocheck — plain JavaScript in a .ts file: esbuild bundles it, nothing here is type-checked.
// Companion Life — Astra plugin: the avatar lives a life of her own between the things that happen.
//
// Four needs drift with time and with what happens (energy, boredom, sociability, joy); from them a
// mood; for the mood, the hour and what you are doing she finds herself something to do every few
// minutes — states of her own animation pack, cued through an Astra command this plugin's page
// creates — and now and then says a word about it in Astra's voice. What happens is read from two
// places only: the time since the last input, the foreground process and the pointer (a small
// PowerShell watcher — never the keys themselves), and the avatar engine's lines in Astra's log
// (music, pats, Astra's work, the state she is in).
import * as import_node_fs from "node:fs";
import * as import_node_path from "node:path";
import * as import_node_child_process from "node:child_process";
import { plugin } from "astra-plugin-sdk";

var CFG = import_node_path.join(process.env.APPDATA || "", "astra", "astra", "config");
var PACK_ROOT = import_node_path.join(CFG, "companion", "pack");
var DATA = import_node_path.join(CFG, "companion-life");
var SETTINGS_FILE = import_node_path.join(DATA, "settings.json");
var AWAY_SEC = 1200;
var WORK_FLAG = import_node_path.join(process.env.APPDATA || "", "astra", "work_mode.on");
var WORK_STATE = "as_work";
var pick = (a) => a[Math.floor(Math.random() * a.length)];
var minutes = (lo, hi) => (lo + Math.random() * (hi - lo)) * 60000;

// ── settings ────────────────────────────────────────────────────────────────
function loadDb() {
  let s = {};
  try {
    s = JSON.parse(import_node_fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {}
  return { soul: { ...SOUL_DEFAULTS, ...s } };
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

// ── her own life: needs, a mood, a day ──────────────────────────────────────
// Between the things that happen to her (music, Astra's work, the pointer, the time of day) she lives
// on her own. Four needs drift with time and with what happens:
//   energy  — falls through the day, faster at night; sleep (and a night away) restores it;
//   boredom — grows while nothing happens to her; music, the pointer, Astra's work, her own pastimes
//             take it down;
//   social  — falls while you are away, grows while you are here, with every pat and every chat;
//   joy     — drifts back to even; pats, music, your return lift it, loneliness wears it down.
// From them a mood: sleepy, lonely, bored, happy or calm. Every few minutes (sooner when bored) she
// picks something to do that suits the mood, the hour and what you are doing — a song to herself,
// her phone, a look around, a snack at snack time, a peek or a stroll, a call for you when lonely —
// from the states her own pack has. Now and then she says a word about it in Astra's voice (rarely,
// only while you are here, never in a game). The needs are kept in `soul.json` across restarts.
var SOUL_DEFAULTS = { on: true, talk: true, pace: 1 };
var SOUL_FILE = import_node_path.join(DATA, "soul.json");
var MOODS = ["happy", "calm", "bored", "lonely", "sleepy"];
var soul = { energy: 80, boredom: 20, social: 60, joy: 60, at: 0, next: 0, said: 0, doing: "", doingAt: 0,
  cool: {}, activeSince: 0, breakAt: 0, day: "", snacks: [], lastPat: 0, pos: 0, log: "", saved: 0, packStates: null, packAt: 0 };

function loadSoul() {
  try {
    Object.assign(soul, JSON.parse(import_node_fs.readFileSync(SOUL_FILE, "utf8")), { pos: 0, log: "", packStates: null });
  } catch {}
}

function saveSoul() {
  const { energy, boredom, social, joy, at, day, snacks, cool, said, activeSince, breakAt } = soul;
  try {
    import_node_fs.mkdirSync(DATA, { recursive: true });
    import_node_fs.writeFileSync(SOUL_FILE, JSON.stringify({ energy, boredom, social, joy, at, day, snacks, cool, said, activeSince, breakAt }));
  } catch {}
}

var clamp = (x) => Math.max(0, Math.min(100, x));

function moodOf(s, hour = new Date().getHours()) {
  const night = hour >= 23 || hour < 6;
  if (s.energy < 25 || (night && s.energy < 50)) return "sleepy";
  if (s.social < 30) return "lonely";
  if (s.boredom > 65) return "bored";
  if (s.joy > 70) return "happy";
  return "calm";
}

// what the needs do over `min` minutes, given what she and you are doing (`ctx`)
function driftSoul(s, min, c) {
  const hour = c.hour ?? new Date().getHours();
  if (c.asleep) s.energy += 2.5 * min;
  else s.energy -= (hour >= 22 || hour < 6 ? 0.3 : 0.12) * min;
  s.boredom += (c.music ? -1.5 : c.near ? -3 : 0.6) * min;
  if (c.away) s.social -= 0.4 * min;
  else if (c.here) s.social += 0.5 * min;
  s.joy += (55 - s.joy) * Math.min(1, 0.01 * min) + (c.music ? 0.5 * min : 0) - (s.social < 30 ? 0.3 * min : 0);
  for (const k of ["energy", "boredom", "social", "joy"]) s[k] = clamp(s[k]);
  return s;
}

// what she can do: a state of her pack (`state`); `moods` weigh it,
// `hours` and `when` gate it, `say` is the key of her words for it
var PASTIMES = [
  { id: "hum", state: "as_lively_hum", moods: { happy: 3, calm: 2 }, say: "hum" },
  { id: "phone", state: "texting", moods: { bored: 3, calm: 1, lonely: 1.5 }, say: "phone" },
  { id: "phone2", state: "phone", moods: { bored: 2, calm: 1 } },
  { id: "think", state: "think", moods: { calm: 1.5, bored: 2 }, say: "think" },
  // her pack has a peek (Anim Studio's walks write `as_peek`): under her window's edge and out again
  { id: "peek", state: "as_peek", moods: { bored: 2.5, calm: 0.5 } },
  { id: "yay", state: "as_lively_yay", moods: { happy: 2 } },
  { id: "heart", state: "as_lively_heart", moods: { happy: 2 }, when: (c) => c.here, say: "heart" },
  { id: "peace", state: "as_lively_peace", moods: { happy: 1.5, calm: 0.5 } },
  { id: "spin", state: "spin", moods: { happy: 1.5, bored: 1 } },
  { id: "shy", state: "shy", moods: { happy: 0.7, calm: 0.3 } },
  { id: "stretch", state: "stretch", moods: { sleepy: 1.5, calm: 0.5, bored: 0.5 } },
  { id: "yawn", state: "yawn", moods: { sleepy: 3 }, say: "sleepy" },
  // you are not here and she is tired: a nap until you come back (the sleep's wake-up ends it)
  { id: "nap", state: "as_sleep", moods: { sleepy: 3 }, when: (c) => c.away, nap: true },
  { id: "sigh", state: "relief", moods: { bored: 1, lonely: 1 } },
  { id: "sad", state: "sad", moods: { lonely: 2 }, say: "lonely" },
  { id: "call", state: "hello", moods: { lonely: 3 }, when: (c) => c.here, say: "call" },
  { id: "snack", state: "eat", moods: { happy: 1, calm: 1, bored: 1, lonely: 1, sleepy: 1 }, snack: true, say: "snack" }
];
var SNACK_HOURS = [[12, 14], [16, 17], [20, 21]];

var SOUL_WORDS = {
  ru: {
    hum: ["Ла-ла-ла…", "Мм-м, привязалась песенка.", "Тра-ля-ля~"],
    phone: ["Так, что там в ленте…", "Ой, смешной мем.", "Пишу подружке, не подглядывай!"],
    think: ["Хм… о чём бы подумать.", "Интересно, а что ты там делаешь?", "Задумалась…"],
    heart: ["Это тебе!", "Лови сердечко~", "Ты молодец, правда."],
    sleepy: ["Ох, глаза слипаются…", "Хочу спатеньки.", "Зевнула. Извини."],
    lonely: ["Мне немножко одиноко…", "Ты где? Я скучаю.", "Тут так тихо без тебя."],
    call: ["Эй, ты тут?", "Обрати на меня внимание~", "Ну посмотри на меня!"],
    snack: ["Время перекуса!", "Ням. Хочешь кусочек?", "Чуть-чуть поем и обратно."],
    break: ["Ты уже долго сидишь. Давай разомнёмся вместе?", "Перерывчик? Потянись со мной!", "Глазки устали? Отдохни минутку."],
    pat: ["Хи-хи, щекотно!", "Ещё погладь~", "Мне приятно."],
    game: ["Давай, ты сможешь!", "Ух, как ты!"]
  },
  en: {
    hum: ["La-la-la…", "Mm, this song's stuck in my head.", "Tra-la-la~"],
    phone: ["Let's see what's new…", "Oh, a funny meme.", "Texting a friend, no peeking!"],
    think: ["Hmm… what to think about.", "I wonder what you're doing.", "Lost in thought…"],
    heart: ["This is for you!", "Catch a heart~", "You're doing great, really."],
    sleepy: ["Oh, my eyes are closing…", "I want to sleep.", "Sorry, I yawned."],
    lonely: ["I feel a bit lonely…", "Where are you? I miss you.", "It's so quiet without you."],
    call: ["Hey, are you there?", "Pay attention to me~", "Look at me!"],
    snack: ["Snack time!", "Yum. Want a bite?", "A little bite and back."],
    break: ["You've been sitting a long time. Let's stretch together?", "A little break? Stretch with me!", "Tired eyes? Rest a minute."],
    pat: ["Hehe, that tickles!", "More pats~", "That's nice."],
    game: ["Come on, you can do it!", "Wow, nice!"]
  }
};

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

// one pastime for the mood: weighted by it, gated by the hour, what she has, and a cool-down
function pickPastime(mood, c, have, cool, now, rnd = Math.random) {
  const hour = c.hour;
  const open = PASTIMES.filter((p) => {
    if (!(p.moods[mood] > 0)) return false;
    if (p.state && !have.has(p.state)) return false;
    if (p.when && !p.when(c)) return false;
    if (p.snack && (!SNACK_HOURS.some(([a, b]) => hour >= a && hour < b) || c.snacks?.includes(`${c.day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`))) return false;
    return !(cool[p.id] > now);
  });
  // snack time comes first when it is open
  const snack = open.find((p) => p.snack);
  if (snack) return snack;
  const total = open.reduce((t, p) => t + p.moods[mood], 0);
  let r = rnd() * total;
  for (const p of open) if ((r -= p.moods[mood]) <= 0) return p;
  return open[open.length - 1] || null;
}

async function soulSay(ctx, db, key, force = false) {
  const now = Date.now();
  if (!db.soul.talk || (!force && now - soul.said < 15 * 60000) || activity.idleSec > 300 || GAMES.has(activity.proc)) return;
  if (!force && Math.random() > 0.45) return;
  soul.said = now;
  const words = SOUL_WORDS[ctxLang === "ru" ? "ru" : "en"][key];
  if (words) await ctx.fireTrigger("anim_say", { text: pick(words) }).catch(() => {});
}
var ctxLang = "ru";

// what happened in the engine since the last look: pats, Astra's work, music
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
  return { mood: moodOf(soul), energy: r(soul.energy), boredom: r(soul.boredom), social: r(soul.social), joy: r(soul.joy),
    doing: soul.doing, doingAgo: soul.doingAt ? r((Date.now() - soul.doingAt) / 1000) : null,
    nextIn: soul.next ? Math.max(0, r((soul.next - Date.now()) / 1000)) : null,
    workingFor: soul.activeSince ? r((Date.now() - soul.activeSince) / 60000) : 0 };
}

async function soulTick(ctx) {
  const db = loadDb();
  if (!db.soul.on) return;
  const now = Date.now(), d = new Date(), hour = d.getHours(), day = d.toDateString();
  if (!soul.at) {
    loadSoul();
    // a night away: she slept
    if (soul.at && now - soul.at > 4 * 3600000) Object.assign(soul, { energy: 90, boredom: 20 });
  }
  const min = Math.min(10, soul.at ? (now - soul.at) / 60000 : 0);
  soul.at = now;
  if (soul.day !== day) Object.assign(soul, { day, snacks: [] });
  const ev = soulEvents();
  const st = avatarState();
  const music = !!st.music && now - st.music < 75000;
  const here = activity.idleSec < 120, away = activity.idleSec > 600;
  const c = { hour, day, music, here, away, near: activity.over >= 10, asleep: dozing.on, snacks: soul.snacks,
  };
  driftSoul(soul, min, c);
  // you are back after a while: she is glad
  if (soul.wasAway && activity.idleSec < 5) Object.assign(soul, { joy: clamp(soul.joy + 20), social: clamp(soul.social + 15), wasAway: false });
  if (activity.idleSec >= AWAY_SEC) soul.wasAway = true;
  if (ev.pat) Object.assign(soul, { joy: clamp(soul.joy + 15), social: clamp(soul.social + 20), boredom: clamp(soul.boredom - 20), lastPat: now });
  if (ev.work) Object.assign(soul, { social: clamp(soul.social + 10), boredom: clamp(soul.boredom - 10) });
  if (now - soul.saved > 120000) {
    soul.saved = now;
    saveSoul();
  }
  // you at the computer without a break: the clock of it, and a nudge after 90 minutes
  if (activity.idleSec > 300) soul.activeSince = 0;
  else if (!soul.activeSince) soul.activeSince = now;
  const free = standing(st) && !dozing.on && !(import_node_fs.existsSync(WORK_FLAG) && activity.idleSec < 30);
  if (!free) return;
  const have = packStates();
  const play = async (state) => {
    soul.doing = state;
    soul.doingAt = now;
    await ctx.fireTrigger("anim_play", { state }).catch(() => {});
  };
  // after a pat, a shy smile or a heart now and then
  if (ev.patEnd && Math.random() < 0.5 && !(soul.cool.pat > now)) {
    soul.cool.pat = now + 120000;
    const s = [have.has("as_lively_heart") && "as_lively_heart", have.has("shy") && "shy"].filter(Boolean);
    if (s.length) await play(pick(s));
    await soulSay(ctx, db, "pat");
    return;
  }
  if (soul.activeSince && now - soul.activeSince > 90 * 60000 && now - soul.breakAt > 90 * 60000 && !GAMES.has(activity.proc)) {
    soul.breakAt = now;
    if (have.has("stretch")) await play("stretch");
    await soulSay(ctx, db, "break", true);
    return;
  }
  if (!soul.next) soul.next = now + minutes(1, 3);
  if (now < soul.next) return;
  const mood = moodOf(soul, hour);
  const pace = Math.max(0.3, Math.min(3, Number(db.soul.pace) || 1));
  const gap = mood === "bored" ? [2, 4] : mood === "sleepy" ? [5, 9] : [3, 7];
  soul.next = now + minutes(gap[0] / pace, gap[1] / pace);
  // in a game: only a quiet cheer now and then
  if (GAMES.has(activity.proc)) {
    if (have.has("as_lively_cheer") && Math.random() < 0.3) await play("as_lively_cheer");
    return;
  }
  const p = pickPastime(mood, c, have, soul.cool, now);
  if (!p) return;
  soul.cool[p.id] = now + minutes(12, 25);
  if (p.snack) soul.snacks.push(`${day}:${hour < 15 ? 1 : hour < 18 ? 2 : 3}`);
  soul.boredom = clamp(soul.boredom - 25);
  if (p.id === "call" || p.id === "heart") soul.social = clamp(soul.social + 5);
  if (p.nap) dozing.on = true;
  await play(p.state);
  if (p.say) await soulSay(ctx, db, p.say, p.id === "call" || p.snack);
}

// ── watching activity: time since the last input, the foreground process and the pointer ─
// Only these are read — never the keys themselves. Over every 2 s the pointer is looked at 20 times:
// how far it went, how often it turned back, and how much of the time it was over her window.
var GAMES = new Set(["dota2", "cs2", "valorant", "valorant-win64-shipping", "deadlock", "project8", "genshinimpact",
  "cyberpunk2077", "robloxplayerbeta", "javaw", "eldenring"]);
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
while ($true) {
  $l = New-Object AI+L; $l.cb = 8; [AI]::GetLastInputInfo([ref]$l) | Out-Null
  $idle = ([uint32]([Environment]::TickCount -band 0xFFFFFFFF) - $l.t) -band 0xFFFFFFFF
  $fp = 0; [AI]::GetWindowThreadProcessId([AI]::GetForegroundWindow(), [ref]$fp) | Out-Null
  $n = (Get-Process -Id $fp -ErrorAction SilentlyContinue).ProcessName
  $av = Get-Process astra-avatar-engine -ErrorAction SilentlyContinue | Select-Object -First 1
  $h = if ($av) { [AI]::Find([uint32]$av.Id) } else { [IntPtr]::Zero }
  $r = New-Object AI+R; if ($h -ne [IntPtr]::Zero) { [AI]::GetWindowRect($h, [ref]$r) | Out-Null }
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
  [Console]::Out.WriteLine("$idle|$n|$path|$turns|$over"); [Console]::Out.Flush()
}`;
var activity = { idleSec: 0, proc: "", seen: false, path: 0, turns: 0, over: 0 };

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
      const [idleStr, proc = "", path, turns, over] = line.trim().split("|");
      const idleSec = Number(idleStr) / 1000;
      if (!Number.isFinite(idleSec)) continue;
      activity = { idleSec, proc: proc.toLowerCase(), seen: true, path: Number(path) || 0, turns: Number(turns) || 0, over: Number(over) || 0 };
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
  return { soul: { ...db.soul, now: soulNow() }, commands: commandsStatus(ctx), character: activeCharacter(),
    ownPack: !!basePackFile(), pastimes: PASTIMES.map((p) => ({ id: p.id, state: p.state, has: !p.state || have.has(p.state) })) };
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
        for (const k of ["on", "talk"]) if (k in patch) s[k] = !!patch[k];
        if ("pace" in patch) s.pace = Math.max(0.3, Math.min(3, Number(patch.pace) || 1));
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
      createCommands: async (_p, ctx) => createCommands(ctx)
    }
  },
  healthCheck: () => ({ healthy: true, status: "ok" })
});
// for test/*.test.mjs
export const internals = { moodOf, driftSoul, pickPastime, PASTIMES, SOUL_WORDS, standing, soul, soulNow, soulTick };
if (require.main === module) app.run();
