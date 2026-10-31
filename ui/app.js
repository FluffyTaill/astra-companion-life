// Companion Life — the page: first steps, her mood and needs, her character, quiet hours, the diary.
const I18N = {
  ru: {
    sub: "Персонаж живёт своей жизнью: потребности, настроение, характер, привязанность, дневник",
    setup: "Первые шаги", setupDone: "Готово, скрыть",
    stepCmds: "Команды Astra — чтобы она могла сама что-то делать и говорить",
    stepPack: "Свой набор анимаций у персонажа — в нём её занятия",
    stepChar: "Выбери ей характер (ниже)",
    stepName: "Как ей тебя называть (необязательно)",
    cmdsCreate: "Создать команды", cmdsCreated: (n) => `Создано команд: ${n}. Перезапусти Astra (трей → Выход, затем открой снова).`,
    cmdsRestart: "записаны — перезапусти Astra, чтобы она их подхватила", cmdsOk: "на месте",
    packOk: (n) => `есть — занятий в нём: ${n}`, packNo: "у персонажа встроенный набор: сделай ему свой (например, в Anim Studio: «Все анимации от другого персонажа»)",
    soul: "Жизнь", soulOn: "Живёт своей жизнью", soulTalk: "Говорит сама", soulPace: "Как часто чем-то занимается",
    moods: { happy: "радостная", calm: "спокойная", bored: "скучает", lonely: "одиноко", sleepy: "сонная" },
    needs: { energy: "бодрость", boredom: "скука", social: "общительность", joy: "радость", bond: "привязанность" },
    doing: "последнее занятие", next: "следующее через", work: "ты без перерыва", ago: "назад", min: "мин", sec: "с",
    together: (d) => `вместе ${d} дн.`, quietNow: "сейчас молчит: тихие часы или микрофон занят", micNow: "микрофон занят — молчит",
    nudge: "▶ Займись чем-нибудь",
    character: "Характер", characterHint: "Меняет, что она любит делать, как быстро скучает и устаёт, как часто и какими словами говорит.",
    chars: { cheerful: "Весёлая", shy: "Застенчивая", lazy: "Ленивая", energetic: "Энергичная", tsundere: "Цундэрэ" },
    charsHint: { cheerful: "напевает, радуется, шлёт сердечки", shy: "смущается, редко зовёт, говорит тихо и мало", lazy: "зевает, дремлет, сидит в телефоне",
      energetic: "кружится, выглядывает, быстро скучает", tsundere: "вздыхает, «не то чтобы я ждала»" },
    name: "Как ей тебя звать", namePh: "например, Даня", tryIt: "▶ Услышать",
    rules: "Когда говорить и что замечать",
    quiet: "Тихие часы", quietFrom: "с", quietTo: "до", calls: "Молчит, пока микрофон занят (созвон)",
    games: "В играх болеет за тебя и спрашивает, как прошло", questions: "Задаёт тебе вопросы", play: "Мини-игры с курсором",
    playTitle: "Мини-игры", playHint: "Прятки: она выглядывает из-под края окна — наведи на неё курсор, пока не спряталась. «Поймай сердечко»: она шлёт сердечко — наведи курсор, пока не улетело. Сама предлагает поиграть, когда скучает (не чаще раза в час).",
    playHide: "▶ Прятки", playCatch: "▶ Поймай сердечко",
    diary: "Дневник", diaryEmpty: "Пока пусто — первые записи появятся сегодня.",
    diaryCols: { work: "за компьютером", pats: "погладили", naps: "дремала", music: "музыка", games: "игр", chats: "задач Astra", played: "мини-игр", late: "после полуночи" },
    pastimes: "Занятия", pastimesHint: "Что она умеет в наборе персонажа «{c}». Плагин ищет состояния по похожим именам (wave/hello, texting/phone…), так что подходит любой набор. Серые — не нашлось.",
    names: { hum: "напевает", phone: "в телефоне", phone2: "телефон", think: "задумалась", peek: "выглядывает", yay: "«ура»", heart: "сердечко тебе",
      peace: "«пис»", spin: "кружится", shy: "смущается", stretch: "потягивается", yawn: "зевает", nap: "дремлет, пока тебя нет", sigh: "вздыхает",
      sad: "грустит", call: "зовёт тебя", snack: "перекус (12–14, 16–17, 20–21)" }
  },
  en: {
    sub: "Your companion lives a life of her own: needs, a mood, a character, attachment, a diary",
    setup: "First steps", setupDone: "Done, hide",
    stepCmds: "Astra commands — so she can do things and talk on her own",
    stepPack: "The character's own animation pack — her pastimes live there",
    stepChar: "Pick her character (below)",
    stepName: "What she should call you (optional)",
    cmdsCreate: "Create commands", cmdsCreated: (n) => `Commands created: ${n}. Restart Astra (tray → Exit, then open it again).`,
    cmdsRestart: "written — restart Astra so it picks them up", cmdsOk: "in place",
    packOk: (n) => `yes — pastimes in it: ${n}`, packNo: "the character plays a built-in pack: give it one of its own (e.g. in Anim Studio: “All animations from another character”)",
    soul: "Life", soulOn: "Lives a life of her own", soulTalk: "Talks on her own", soulPace: "How often she does something",
    moods: { happy: "happy", calm: "calm", bored: "bored", lonely: "lonely", sleepy: "sleepy" },
    needs: { energy: "energy", boredom: "boredom", social: "sociability", joy: "joy", bond: "attachment" },
    doing: "last pastime", next: "next in", work: "you without a break", ago: "ago", min: "min", sec: "s",
    together: (d) => `together ${d} d`, quietNow: "quiet now: quiet hours or a microphone in use", micNow: "microphone in use — quiet",
    nudge: "▶ Do something",
    character: "Character", characterHint: "Changes what she likes to do, how fast she gets bored and tired, how often and with what words she talks.",
    chars: { cheerful: "Cheerful", shy: "Shy", lazy: "Lazy", energetic: "Energetic", tsundere: "Tsundere" },
    charsHint: { cheerful: "hums, rejoices, sends hearts", shy: "goes shy, rarely calls, talks little", lazy: "yawns, naps, sits in her phone",
      energetic: "spins, peeks, gets bored fast", tsundere: "sighs, “not that I was waiting”" },
    name: "What she calls you", namePh: "e.g. Dan", tryIt: "▶ Hear",
    rules: "When to talk and what to notice",
    quiet: "Quiet hours", quietFrom: "from", quietTo: "to", calls: "Quiet while a microphone is in use (a call)",
    games: "Cheers in games and asks how it went", questions: "Asks you things", play: "Little games with the pointer",
    playTitle: "Little games", playHint: "Hide and seek: she peeks out from under her window's edge — point at her before she hides. Catch the heart: she sends a heart — point at her before it flies away. She offers a game herself when bored (at most once an hour).",
    playHide: "▶ Hide and seek", playCatch: "▶ Catch the heart",
    diary: "Diary", diaryEmpty: "Empty so far — the first entries appear today.",
    diaryCols: { work: "at the computer", pats: "pats", naps: "naps", music: "music", games: "games", chats: "Astra tasks", played: "little games", late: "after midnight" },
    pastimes: "Pastimes", pastimesHint: "What she can do in the pack of “{c}”. The plugin finds states by similar names (wave/hello, texting/phone…), so any pack will do. Greyed out — not found.",
    names: { hum: "hums", phone: "on her phone", phone2: "phone", think: "lost in thought", peek: "peeks", yay: "“yay”", heart: "a heart for you",
      peace: "“peace”", spin: "spins", shy: "goes shy", stretch: "stretches", yawn: "yawns", nap: "naps while you are away", sigh: "sighs",
      sad: "gets sad", call: "calls you", snack: "a snack (12–14, 16–17, 20–21)" }
  }
};
let lang = (() => {
  try { return localStorage.getItem("cl-lang") || (navigator.language || "ru").slice(0, 2); } catch { return "ru"; }
})();
if (!I18N[lang]) lang = "en";
const T = (k) => I18N[lang][k];

let st = { soul: {}, commands: {}, pastimes: [], diary: [], characters: [] };
let banner = null;
const call = (m, p = {}) => window.astra.callBackend(m, p);
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(t) {
  const el = document.getElementById("toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.style.display = "none"), 3200);
}
const min = (m) => (m < 60 ? `${m} ${T("min")}` : `${Math.floor(m / 60)} ч ${m % 60 ? `${m % 60} ${T("min")}` : ""}`.trim());

async function refresh() {
  st = await call("getState");
  render();
}

function cmdState() {
  const c = st.commands || {};
  const all = ["anim_play", "anim_say"];
  if (all.every((t) => c[t]?.listening)) return "ok";
  if (all.every((t) => c[t]?.inFile)) return "restart";
  return "missing";
}

function setupCard() {
  const S = st.soul || {};
  const cmd = cmdState();
  const found = (st.pastimes || []).filter((p) => p.state).length;
  const step = (ok, text, extra) => `<div class="opt" style="gap:10px"><span style="font-size:18px">${ok ? "✅" : "⬜"}</span><span>${text}${extra ? ` — <span class="muted">${extra}</span>` : ""}</span></div>`;
  return `<div class="card">
    <h2>${T("setup")}</h2>
    <div style="display:grid;gap:8px">
      ${step(cmd === "ok", T("stepCmds"), cmd === "ok" ? T("cmdsOk") : cmd === "restart" ? T("cmdsRestart") : `<button class="btn primary" onclick="createCommands()">${T("cmdsCreate")}</button>`)}
      ${step(st.ownPack && found > 3, T("stepPack"), st.ownPack ? T("packOk")(found) : T("packNo"))}
      ${step(!!S.character, T("stepChar"), T("chars")[S.character])}
      ${step(!!S.name, T("stepName"), S.name ? esc(S.name) : "")}
    </div>
    <div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn" onclick="setSoul({setup: true})">${T("setupDone")}</button></div>
  </div>`;
}

function soulCard() {
  const S = st.soul || {}, N = S.now || {};
  const ago = (sec) => (sec == null ? "—" : sec < 90 ? `${sec} ${T("sec")}` : `${Math.round(sec / 60)} ${T("min")}`);
  const bar = (k) => `<div class="opt" style="min-width:210px">${T("needs")[k]}
    <span style="display:inline-block;width:110px;height:8px;border-radius:4px;background:var(--toggle-off);margin-left:8px;overflow:hidden">
      <span style="display:block;height:100%;width:${N[k] ?? 0}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></span>
    <span class="muted" style="margin-left:6px">${N[k] ?? "—"}</span></div>`;
  const named = (st.pastimes || []).find((p) => p.state === N.doing);
  const doing = N.doing ? (named ? T("names")[named.id] : N.doing) : "—";
  return `<div class="card">
    <h2>${T("soul")} ${S.on && N.mood ? `<span class="muted">· ${T("moods")[N.mood] || N.mood} · ${T("together")(N.together || 1)}</span>` : ""}</h2>
    <div class="opts" style="margin-bottom:10px">
      <div class="opt"><div class="switch ${S.on ? "on" : ""}" onclick="setSoul({on: ${!S.on}})"></div>${T("soulOn")}</div>
      <div class="opt"><div class="switch ${S.talk ? "on" : ""}" onclick="setSoul({talk: ${!S.talk}})"></div>${T("soulTalk")}</div>
      <div class="opt">${T("soulPace")}
        <input type="range" min="30" max="300" value="${Math.round((S.pace || 1) * 100)}" onchange="setSoul({pace: this.value / 100})"> ${Math.round((S.pace || 1) * 100)}%</div>
    </div>
    ${S.on ? `<div class="opts">${["energy", "boredom", "social", "joy", "bond"].map(bar).join("")}</div>
      ${N.quiet ? `<div class="muted" style="margin-top:6px">🤫 ${N.mic ? T("micNow") : T("quietNow")}</div>` : ""}
      <div class="row" style="margin-top:10px;justify-content:space-between">
        <span class="muted">${T("doing")}: ${esc(doing)}${N.doingAgo != null ? ` (${ago(N.doingAgo)} ${T("ago")})` : ""}
          · ${T("next")}: ${ago(N.nextIn)} · ${T("work")}: ${N.workingFor || 0} ${T("min")}</span>
        <button class="btn" onclick="nudge()">${T("nudge")}</button></div>` : ""}
  </div>`;
}

function characterCard() {
  const S = st.soul || {};
  return `<div class="card">
    <h2>${T("character")}</h2>
    <div class="muted" style="margin-bottom:10px">${T("characterHint")}</div>
    <div class="row" style="flex-wrap:wrap">${(st.characters || []).map((c) => `
      <span class="chip ${S.character === c ? "on" : ""}" title="${esc(T("charsHint")[c])}" onclick="setSoul({character: '${c}'})">${T("chars")[c]}</span>`).join("")}
      <span class="muted">${esc(T("charsHint")[S.character] || "")}</span></div>
    <div class="row" style="margin-top:12px">${T("name")}
      <input class="text" style="width:200px" value="${esc(S.name || "")}" placeholder="${esc(T("namePh"))}" onchange="setSoul({name: this.value})">
      <button class="btn" onclick="tryIt('call')">${T("tryIt")}</button></div>
  </div>`;
}

function rulesCard() {
  const S = st.soul || {}, Q = S.quiet || {};
  const sw = (k, label) => `<div class="opt"><div class="switch ${S[k] ? "on" : ""}" onclick="setSoul({${k}: ${!S[k]}})"></div>${label}</div>`;
  const hour = (k) => `<input class="text" style="width:56px" type="number" min="0" max="23" value="${Q[k] ?? 0}" onchange="setSoul({quiet: {${k}: this.value}})">`;
  return `<div class="card">
    <h2>${T("rules")}</h2>
    <div class="opts">
      <div class="opt"><div class="switch ${Q.on ? "on" : ""}" onclick="setSoul({quiet: {on: ${!Q.on}}})"></div>${T("quiet")}
        ${Q.on ? `${T("quietFrom")} ${hour("from")} ${T("quietTo")} ${hour("to")}` : ""}</div>
      ${sw("calls", T("calls"))}${sw("games", T("games"))}${sw("questions", T("questions"))}${sw("play", T("play"))}
    </div>
  </div>`;
}

function playCard() {
  return `<div class="card">
    <h2>${T("playTitle")}</h2>
    <div class="muted" style="margin-bottom:10px">${T("playHint")}</div>
    <div class="row"><button class="btn" onclick="playGame('hide')">${T("playHide")}</button><button class="btn" onclick="playGame('catch')">${T("playCatch")}</button></div>
  </div>`;
}

function diaryCard() {
  const D = st.diary || [];
  const cols = T("diaryCols");
  return `<div class="card">
    <h2>${T("diary")}</h2>
    ${D.length ? D.slice(0, 7).map((d) => `<div style="padding:8px 0;border-top:1px solid var(--line)">
      <b>${esc(d.day)}</b> <span class="muted">— ${esc(d.text)}</span>
      <div class="muted" style="margin-top:4px;font-size:12px">${cols.work}: ${min(d.work)} · ${cols.pats}: ${d.pats} · ${cols.naps}: ${d.naps} · ${cols.music}: ${min(d.music)}
        · ${cols.games}: ${d.games} · ${cols.chats}: ${d.chats} · ${cols.played}: ${d.played}${d.late ? ` · ${cols.late}: ${min(d.late)}` : ""}</div></div>`).join("")
      : `<div class="muted">${T("diaryEmpty")}</div>`}
  </div>`;
}

function pastimesCard() {
  const P = st.pastimes || [];
  return `<div class="card">
    <h2>${T("pastimes")}</h2>
    <div class="muted" style="margin-bottom:10px">${esc(T("pastimesHint").replace("{c}", st.character || "—"))}</div>
    <div class="row">${P.map((p) => `<span class="chip ${p.state ? "on" : ""}" title="${esc(p.state || "")}">${esc(T("names")[p.id] || p.id)}</span>`).join("")}</div>
  </div>`;
}

function render() {
  const S = st.soul || {};
  document.getElementById("root").innerHTML = `
  <div class="top">
    <div><h1><span>Companion Life</span></h1><div class="sub">${T("sub")}</div></div>
    <div class="row"><button class="btn" onclick="toggleLang()">${lang === "ru" ? "EN" : "RU"}</button></div>
  </div>
  ${banner ? `<div class="${banner.cls}">${esc(banner.text)}</div>` : ""}
  ${!S.setup || cmdState() !== "ok" ? setupCard() : ""}
  ${soulCard()}
  ${characterCard()}
  ${rulesCard()}
  ${S.play ? playCard() : ""}
  ${diaryCard()}
  ${pastimesCard()}`;
}

async function setSoul(patch) {
  await call("setSoul", { patch });
  await refresh();
}
async function nudge() {
  await call("nudge");
  toast("…");
}
async function tryIt(key) {
  const text = await call("sayNow", { key });
  if (text) toast(text);
}
async function playGame(kind) {
  const r = await call("playGame", { kind });
  if (!r?.ok) toast("…");
}
async function createCommands() {
  try {
    const r = await call("createCommands");
    banner = { cls: "ok", text: T("cmdsCreated")(r.added) };
  } catch (e) {
    banner = { cls: "err", text: e.message };
  }
  await refresh();
}
function toggleLang() {
  lang = lang === "ru" ? "en" : "ru";
  try { localStorage.setItem("cl-lang", lang); } catch {}
  render();
}
// her needs change by themselves: the card follows them while the page is open
setInterval(() => {
  if (!st.soul?.on || document.hidden || document.querySelector("input:focus")) return;
  call("soulNow").then((n) => { st.soul.now = n; render(); }).catch(() => {});
}, 10000);

refresh().catch((e) => {
  document.getElementById("root").innerHTML = `<div class="err">Companion Life: ${esc(e.message)}</div>`;
});
