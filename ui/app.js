// Companion Life — the page: her mood and needs as they are now, the switches, the Astra commands.
const I18N = {
  ru: {
    sub: "Персонаж живёт своей жизнью: потребности, настроение, занятия, распорядок дня",
    cmds: "Команды Astra", cmdsOk: "Команды на месте — она будет сама чем-то заниматься и иногда говорить.",
    cmdsMissing: "Чтобы она сама играла занятия и говорила, нужны две команды Astra. Плагин может создать их сам.",
    cmdsRestart: "Команды записаны. Перезапусти Astra (значок в трее → Выход, затем открой снова), чтобы она их подхватила. До перезапуска не меняй команды в Astra — она перезапишет файл.",
    cmdsCreate: "Создать команды", cmdsCreated: (n) => `Создано команд: ${n}. Перезапусти Astra.`,
    soul: "Жизнь", soulOn: "Живёт своей жизнью", soulTalk: "Говорит сама (редко)", soulPace: "Как часто чем-то занимается",
    soulHint: "У неё есть бодрость, скука, общительность и радость — они меняются со временем и от того, что происходит: гладишь её, болтаешь с Astra, играет музыка, ты долго не подходишь. Из них — настроение, и под настроение, время суток и то, что делаешь ты, она сама находит себе занятия. После поглаживания смущается, в игре тихо болеет за тебя, через полтора часа работы без перерыва зовёт размяться. Говорит не чаще раза в 15 минут, только пока ты рядом.",
    moods: { happy: "радостная", calm: "спокойная", bored: "скучает", lonely: "одиноко", sleepy: "сонная" },
    needs: { energy: "бодрость", boredom: "скука", social: "общительность", joy: "радость" },
    doing: "последнее занятие", next: "следующее через", work: "ты без перерыва", ago: "назад", min: "мин", sec: "с",
    nudge: "▶ Займись чем-нибудь сейчас",
    pastimes: "Занятия", pastimesHint: "Что она умеет — из её собственного набора анимаций. Серые — состояний нет в наборе персонажа «{c}», их она пропускает.",
    noPack: "У надетого персонажа встроенный набор анимаций — в нём почти нет занятий. Дай персонажу свой набор (в Anim Studio: «Все анимации от другого персонажа» или «Сделать свой набор»).",
    names: { hum: "напевает", phone: "в телефоне", phone2: "телефон", think: "задумалась", peek: "выглядывает", yay: "«ура»", heart: "сердечко тебе",
      peace: "«пис»", spin: "кружится", shy: "смущается", stretch: "потягивается", yawn: "зевает", nap: "дремлет, пока тебя нет", sigh: "вздыхает",
      sad: "грустит", call: "зовёт тебя", snack: "перекус (12–14, 16–17, 20–21)" }
  },
  en: {
    sub: "Your companion lives a life of her own: needs, a mood, pastimes, a day",
    cmds: "Astra commands", cmdsOk: "The commands are in place — she will find herself things to do and sometimes talk.",
    cmdsMissing: "To play her pastimes and talk she needs two Astra commands. The plugin can create them.",
    cmdsRestart: "The commands are written. Restart Astra (tray icon → Exit, then open it again) so it picks them up. Do not change commands in Astra before that — it would overwrite the file.",
    cmdsCreate: "Create commands", cmdsCreated: (n) => `Commands created: ${n}. Restart Astra.`,
    soul: "Life", soulOn: "Lives a life of her own", soulTalk: "Talks on her own (rarely)", soulPace: "How often she does something",
    soulHint: "She has energy, boredom, sociability and joy — they change with time and with what happens: you pat her, chat with Astra, music plays, you stay away. From them a mood, and for the mood, the hour and what you are doing she finds herself things to do. After a pat she goes shy, in a game she quietly cheers you on, after an hour and a half of work without a break she calls you to stretch. She talks at most once in 15 minutes, only while you are here.",
    moods: { happy: "happy", calm: "calm", bored: "bored", lonely: "lonely", sleepy: "sleepy" },
    needs: { energy: "energy", boredom: "boredom", social: "sociability", joy: "joy" },
    doing: "last pastime", next: "next in", work: "you without a break", ago: "ago", min: "min", sec: "s",
    nudge: "▶ Do something now",
    pastimes: "Pastimes", pastimesHint: "What she can do — from her own animation pack. Greyed out — the character “{c}” has no such state, she skips them.",
    noPack: "The worn character plays a built-in animation pack — it has hardly any pastimes. Give the character a pack of her own (in Anim Studio: “All animations from another character” or “Make her own pack”).",
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

let st = { soul: {}, commands: {}, pastimes: [] };
let banner = null;
const call = (m, p = {}) => window.astra.callBackend(m, p);
const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(t) {
  const el = document.getElementById("toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.style.display = "none"), 2600);
}

async function refresh() {
  st = await call("getState");
  render();
}

function commandsCard() {
  const c = st.commands || {};
  const all = ["anim_play", "anim_say"];
  const listening = all.every((t) => c[t]?.listening), inFile = all.every((t) => c[t]?.inFile);
  if (listening) return `<div class="ok">${T("cmdsOk")}</div>`;
  if (inFile) return `<div class="notice">${T("cmdsRestart")}</div>`;
  return `<div class="notice">${T("cmdsMissing")} <button class="btn primary" style="margin-left:8px" onclick="createCommands()">${T("cmdsCreate")}</button></div>`;
}

function soulCard() {
  const S = st.soul || {}, N = S.now || {};
  const ago = (sec) => (sec == null ? "—" : sec < 90 ? `${sec} ${T("sec")}` : `${Math.round(sec / 60)} ${T("min")}`);
  const bar = (k) => `<div class="opt" style="min-width:200px">${T("needs")[k]}
    <span style="display:inline-block;width:110px;height:8px;border-radius:4px;background:var(--toggle-off);margin-left:8px;overflow:hidden">
      <span style="display:block;height:100%;width:${N[k] ?? 0}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></span></span>
    <span class="muted" style="margin-left:6px">${N[k] ?? "—"}</span></div>`;
  const doing = N.doing ? (T("names")[(st.pastimes || []).find((p) => p.state === N.doing)?.id] || N.doing) : "—";
  return `<div class="card">
    <h2>${T("soul")} ${S.on && N.mood ? `<span class="muted">· ${T("moods")[N.mood] || N.mood}</span>` : ""}</h2>
    <div class="muted" style="margin-bottom:10px">${T("soulHint")}</div>
    <div class="opts" style="margin-bottom:10px">
      <div class="opt"><div class="switch ${S.on ? "on" : ""}" onclick="setSoul({on: ${!S.on}})"></div>${T("soulOn")}</div>
      <div class="opt"><div class="switch ${S.talk ? "on" : ""}" onclick="setSoul({talk: ${!S.talk}})"></div>${T("soulTalk")}</div>
      <div class="opt">${T("soulPace")}
        <input type="range" min="30" max="300" value="${Math.round((S.pace || 1) * 100)}" onchange="setSoul({pace: this.value / 100})"> ${Math.round((S.pace || 1) * 100)}%</div>
    </div>
    ${S.on ? `<div class="opts">${["energy", "boredom", "social", "joy"].map(bar).join("")}</div>
      <div class="row" style="margin-top:10px;justify-content:space-between">
        <span class="muted">${T("doing")}: ${esc(doing)}${N.doingAgo != null ? ` (${ago(N.doingAgo)} ${T("ago")})` : ""}
          · ${T("next")}: ${ago(N.nextIn)} · ${T("work")}: ${N.workingFor || 0} ${T("min")}</span>
        <button class="btn" onclick="nudge()">${T("nudge")}</button></div>` : ""}
  </div>`;
}

function pastimesCard() {
  const P = st.pastimes || [];
  return `<div class="card">
    <h2>${T("pastimes")}</h2>
    ${st.ownPack ? "" : `<div class="notice">${T("noPack")}</div>`}
    <div class="muted" style="margin-bottom:10px">${esc(T("pastimesHint").replace("{c}", st.character || "—"))}</div>
    <div class="row">${P.map((p) => `<span class="chip ${p.has ? "on" : ""}" title="${esc(p.state || "")}">${esc(T("names")[p.id] || p.id)}</span>`).join("")}</div>
  </div>`;
}

function render() {
  document.getElementById("root").innerHTML = `
  <div class="top">
    <div><h1><span>Companion Life</span></h1><div class="sub">${T("sub")}</div></div>
    <div class="row"><button class="btn" onclick="toggleLang()">${lang === "ru" ? "EN" : "RU"}</button></div>
  </div>
  ${banner ? `<div class="${banner.cls}">${esc(banner.text)}</div>` : ""}
  <div class="card"><h2>${T("cmds")}</h2>${commandsCard()}</div>
  ${soulCard()}
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
  if (!st.soul?.on || document.hidden) return;
  call("soulNow").then((n) => { st.soul.now = n; render(); }).catch(() => {});
}, 10000);

refresh().catch((e) => {
  document.getElementById("root").innerHTML = `<div class="err">Companion Life: ${esc(e.message)}</div>`;
});
