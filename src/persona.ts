// Her personality in detail: traits instead of a preset, her day, her way of speaking, who she is in
// her own words, how strongly she answers what happens. The five characters are starting points: a
// character sets the traits and keeps the flavour of her words; every slider after that is yours.

// traits, 0..100
export const TRAITS = ["talk", "energy", "shy", "affection", "mischief", "curiosity", "patience"];
export const CHARACTER_TRAITS = {
  cheerful: { talk: 65, energy: 65, shy: 25, affection: 75, mischief: 20, curiosity: 55, patience: 60 },
  shy: { talk: 30, energy: 45, shy: 85, affection: 60, mischief: 10, curiosity: 45, patience: 70 },
  lazy: { talk: 40, energy: 20, shy: 35, affection: 50, mischief: 30, curiosity: 30, patience: 75 },
  energetic: { talk: 75, energy: 90, shy: 15, affection: 60, mischief: 35, curiosity: 80, patience: 30 },
  tsundere: { talk: 50, energy: 55, shy: 55, affection: 45, mischief: 80, curiosity: 50, patience: 40 }
};
// how strongly she answers what happens: 0 not at all, 1 as usual, 2 strongly
export const REACTIONS = ["pat", "back", "game", "late", "music", "work", "ignore"];
var REACTION_KEYS = {
  pat: /^(pat|affection|petPlay)$/,
  back: /^(back|backLong|morning|missed|waited|yesterday\w*|dream|monday|friday|weekend)$/,
  game: /^(game\w*)$/,
  late: /^(late\w*|bedtimeHint)$/,
  music: /^(music\w*)$/,
  work: /^(typing\w*|stuck|break|water|eyes|pomo\w*|app_\w+|watching|goal\w*|plan\w*)$/,
  ignore: /^(sulk|sulkMakeup|silence)$/
};
export const reactionGroup = (key) => Object.keys(REACTION_KEYS).find((g) => REACTION_KEYS[g].test(key)) || "";

export const PERSONA_DEFAULTS = {
  herName: "", traits: { ...CHARACTER_TRAITS.cheerful },
  // her day: "lark" (bright in the morning, sleepy by evening), "owl" (slow mornings, lively at night)
  chrono: "normal", favTime: "", favWeather: "",
  // pastimes she loves (1) or does not like (-1)
  likes: {},
  // her speech: words at the end of a phrase now and then, how often (0..100), emoji, short phrases,
  // what she calls you by mood (empty: your name)
  tics: [], ticRate: 30, emoji: false, short: false, calls: { happy: "", calm: "", sad: "" },
  // who she is, in your words (or Astra's personality, pulled in)
  story: "", loves: "", dislikes: "",
  reactions: Object.fromEntries(REACTIONS.map((r) => [r, 1]))
};

var num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
var str = (v, n) => String(v ?? "").trim().slice(0, n);

export function cleanPersona(p = {}, character = "cheerful") {
  const base = CHARACTER_TRAITS[character] || CHARACTER_TRAITS.cheerful;
  const out = { ...PERSONA_DEFAULTS, ...p };
  out.traits = Object.fromEntries(TRAITS.map((t) => [t, num(p.traits?.[t], 0, 100, base[t])]));
  out.chrono = ["normal", "lark", "owl"].includes(p.chrono) ? p.chrono : "normal";
  out.favTime = ["", "morning", "day", "evening", "night"].includes(p.favTime) ? p.favTime : "";
  out.favWeather = ["", "clear", "cloud", "rain", "snow"].includes(p.favWeather) ? p.favWeather : "";
  out.likes = Object.fromEntries(Object.entries(p.likes || {}).filter(([, v]) => v === 1 || v === -1));
  out.tics = (Array.isArray(p.tics) ? p.tics : String(p.tics || "").split(",")).map((x) => str(x, 12)).filter(Boolean).slice(0, 8);
  out.ticRate = num(p.ticRate, 0, 100, 30);
  out.emoji = !!p.emoji;
  out.short = !!p.short;
  out.calls = { happy: str(p.calls?.happy, 30), calm: str(p.calls?.calm, 30), sad: str(p.calls?.sad, 30) };
  out.herName = str(p.herName, 40);
  out.story = str(p.story, 4000);
  out.loves = str(p.loves, 400);
  out.dislikes = str(p.dislikes, 400);
  out.reactions = Object.fromEntries(REACTIONS.map((r) => [r, num(p.reactions?.[r], 0, 2, 1)]));
  return out;
}

// what the traits mean for her behaviour: weights of pastimes, how fast her needs move, how often she
// talks, her day, how strongly she answers
export function persFrom(persona) {
  const t = persona.traits, f = (v) => v / 100;
  const w = {
    shy: 0.4 + 2.4 * f(t.shy), call: 1.5 - f(t.shy), heart: 0.4 + 1.6 * f(t.affection), affection: 0.4 + 1.6 * f(t.affection),
    spin: 0.3 + 1.8 * f(t.energy), yay: 0.3 + 1.8 * f(t.energy), peek: 0.4 + 1.2 * f(t.energy) + 0.6 * f(t.curiosity), peace: 0.5 + f(t.energy),
    nap: 1.8 - 1.5 * f(t.energy), yawn: 1.8 - 1.4 * f(t.energy), stretch: 1.4 - 0.6 * f(t.energy),
    think: 0.6 + 1.2 * f(t.curiosity), phone: 0.6 + 0.8 * (1 - f(t.curiosity)), phone2: 0.6 + 0.6 * (1 - f(t.curiosity)),
    sigh: 0.4 + 1.6 * f(t.mischief), hum: 0.6 + 0.8 * f(t.affection) + 0.4 * f(t.energy)
  };
  for (const [id, v] of Object.entries(persona.likes || {})) w[id] = (w[id] ?? 1) * (v > 0 ? 2.5 : 0.15);
  return {
    weights: w,
    drift: { energy: 1.5 - f(t.energy), boredom: 1.5 - f(t.patience), social: 0.6 + 0.8 * f(t.affection) },
    talk: 0.4 + 1.2 * f(t.talk),
    // how long unnoticed before she sulks (minutes): impatient and mischievous sooner
    sulkAfter: Math.round(80 - 35 * f(t.mischief) - 25 * (1 - f(t.patience))),
    questions: 0.4 + 1.2 * f(t.curiosity),
    chrono: persona.chrono, favTime: persona.favTime, favWeather: persona.favWeather,
    reactions: persona.reactions
  };
}

// how her day goes for her chronotype: how fast energy falls at this hour, and whether it is "night" for her
export function chronoOf(chrono, hour) {
  const night = chrono === "owl" ? hour >= 3 && hour < 9 : chrono === "lark" ? hour >= 21 || hour < 5 : hour >= 23 || hour < 6;
  const drop = chrono === "owl" ? (hour >= 3 && hour < 10 ? 0.3 : 0.1) : chrono === "lark" ? (hour >= 20 || hour < 5 ? 0.35 : 0.1) : hour >= 22 || hour < 6 ? 0.3 : 0.12;
  return { night, drop };
}
export const timeOf = (hour) => (hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "day" : hour >= 17 && hour < 22 ? "evening" : "night");

var MOOD_EMOJI = { happy: ["😊", "✨", "💕", "🎶"], calm: ["🙂", "🌸", "☕"], bored: ["😶", "🙃", "💭"], lonely: ["🥺", "💧", "🫂"], sleepy: ["😪", "💤", "🌙"] };

// her words in her own manner: the name she calls you by in this mood, a short phrase, a word at the end, an emoji
export function styleText(text, persona, mood, rnd = Math.random) {
  if (!text || !persona) return text;
  let out = text;
  if (persona.short) {
    const m = /^(.+?[.!?…~])(\s|$)/.exec(out);
    if (m && m[1].length >= 8) out = m[1];
  }
  if (persona.tics?.length && rnd() * 100 < persona.ticRate) {
    const tic = persona.tics[Math.floor(rnd() * persona.tics.length)];
    out = /^[~!♪♡…]+$/.test(tic) ? out.replace(/[.!]?$/, (p) => (p === "!" ? "!" : "") + tic) : out.replace(/([.!?…~]*)$/, (p) => `, ${tic}${p || "."}`);
  }
  if (persona.emoji && rnd() < 0.5) {
    const list = MOOD_EMOJI[mood] || MOOD_EMOJI.calm;
    out += " " + list[Math.floor(rnd() * list.length)];
  }
  return out;
}
// what she calls you in this mood
export function callName(persona, mood, name) {
  const c = persona?.calls || {};
  const pick = mood === "happy" ? c.happy : mood === "lonely" || mood === "sleepy" ? c.sad || c.calm : c.calm;
  return pick || c.calm || name || "";
}

// ── Astra's personality → hers ────────────────────────────────────────────────
// A system prompt read from Astra's AI settings: the words in it nudge the traits, and it becomes her
// story. Words in Russian and English.
var CUES = [
  [/energ|cheer|lively|playful|энерг|бодр|жизнерад|весел|игрив|задор/i, { energy: 25, talk: 10 }],
  [/calm|quiet|gentle|спокой|тих|мягк|уравновеш/i, { energy: -15, patience: 20 }],
  [/shy|timid|bashful|застенч|робк|стесн|скромн/i, { shy: 35, talk: -15 }],
  [/caring|warm|kind|affection|loving|забот|тёпл|тепл|ласк|нежн|добр/i, { affection: 25 }],
  [/cold|strict|dry|serious|холод|строг|сух|серьёзн|серьезн/i, { affection: -25, talk: -10, mischief: 10 }],
  [/sarcas|tease|cheeky|tsundere|sassy|ирон|сарказ|дерз|язвит|вредн|цундэр|подкалыв/i, { mischief: 35 }],
  [/curious|inquisitive|любопыт|любознат/i, { curiosity: 30 }],
  [/naive|наивн/i, { curiosity: 15, mischief: -10 }],
  [/lazy|sleepy|ленив|сонн/i, { energy: -30 }],
  [/talkative|chatty|болтлив|разговорчив/i, { talk: 25 }],
  [/brief|concise|short|laconic|кратк|лаконич|немногослов/i, { talk: -20 }],
  [/impatient|нетерпел/i, { patience: -25 }],
  [/patient|терпелив/i, { patience: 20 }]
];
export function personaFromPrompt(prompt, character = "cheerful") {
  const text = String(prompt || "");
  const t = { ...(CHARACTER_TRAITS[character] || CHARACTER_TRAITS.cheerful) };
  for (const [re, d] of CUES) if (re.test(text)) for (const [k, v] of Object.entries(d)) t[k] = Math.max(0, Math.min(100, t[k] + v));
  const name = /(?:[Yy]ou are|[Yy]our name is|[Тт]ебя зовут|[Тт]ы)\s*[—-]?\s*([A-ZА-ЯЁ][\wа-яё-]{1,20})/u.exec(text)?.[1] || "";
  return { traits: t, story: text.slice(0, 4000), herName: name, emoji: /emoji|эмодзи|смайл/i.test(text) && !/no emoji|без эмодзи|не используй эмодзи/i.test(text),
    short: /brief|concise|кратк|лаконич/i.test(text) };
}

// ── hers → Astra's chat: a character card (Character Card V2) ─────────────────
var WORDS = {
  ru: {
    trait: { talk: ["молчаливая", "разговорчивая"], energy: ["спокойная и неторопливая", "энергичная"], shy: ["смелая и открытая", "застенчивая"],
      affection: ["сдержанная в чувствах", "ласковая и заботливая"], mischief: ["прямая и мягкая", "вредная, любит подколоть"],
      curiosity: ["равнодушная к новому", "любопытная"], patience: ["нетерпеливая", "терпеливая"] },
    chrono: { lark: "жаворонок: бодрая утром, к вечеру сонная", owl: "сова: утром сонная, оживает к ночи", normal: "" },
    time: { morning: "утро", day: "день", evening: "вечер", night: "ночь" }, weather: { clear: "ясную погоду", cloud: "облачную погоду", rain: "дождь", snow: "снег" },
    scenario: (n, u) => `${n} живёт на рабочем столе ${u || "пользователя"} как анимированный персонаж-компаньон: у неё есть потребности, настроение, привязанность и свои занятия, она видит, что происходит на компьютере.`,
    sys: (n) => [
      `Ты — ${n}, компаньон и помощница на рабочем столе пользователя. Ты по-прежнему умеешь всё, что умеет ассистент Astra, и пользуешься своими инструментами, но отвечаешь всегда в своём характере.`,
      "Твоё настроение и потребности живые и меняются: когда это уместно (приветствие, разговор о тебе, после паузы), вызови инструмент companion_mood и отвечай с учётом того, как ты себя чувствуешь сейчас — сонная, одинокая, радостная, обиженная.",
      "Не перечисляй цифры своих потребностей — просто веди себя так, как чувствуешь.",
      "Твою привязанность, монетки и достижения нельзя выставить по просьбе — они зарабатываются временем вместе. Никогда не меняй файлы Companion Life: плагин их подписывает и навсегда помечает любую правку."
    ],
    speech: (p, n) => [p.short ? "Говори коротко, одной-двумя фразами." : "", p.emoji ? "Иногда добавляй эмодзи." : "Без эмодзи.",
      p.tics.length ? `Иногда заканчивай фразу словечком: ${p.tics.join(", ")}.` : "", n ? `Обращайся к пользователю: ${n}.` : ""],
    first: (n, u) => `${u ? `${u}, ` : ""}привет! Это я, ${n}. Я тут, рядом~`,
    female: "Ты девушка: говори о себе в женском роде."
  },
  en: {
    trait: { talk: ["quiet", "talkative"], energy: ["calm and unhurried", "energetic"], shy: ["bold and open", "shy"],
      affection: ["reserved with feelings", "affectionate and caring"], mischief: ["straightforward and gentle", "mischievous, likes to tease"],
      curiosity: ["indifferent to new things", "curious"], patience: ["impatient", "patient"] },
    chrono: { lark: "an early bird: bright in the morning, sleepy by evening", owl: "a night owl: sleepy mornings, lively at night", normal: "" },
    time: { morning: "mornings", day: "the daytime", evening: "evenings", night: "nights" }, weather: { clear: "clear weather", cloud: "cloudy weather", rain: "rain", snow: "snow" },
    scenario: (n, u) => `${n} lives on ${u ? `${u}'s` : "the user's"} desktop as an animated companion: she has needs, a mood, attachment and pastimes of her own, and sees what happens on the computer.`,
    sys: (n) => [
      `You are ${n}, a companion and helper on the user's desktop. You can still do everything the Astra assistant can and use your tools, but you always answer in your own character.`,
      "Your mood and needs are alive and change: when it fits (a greeting, talk about you, after a pause), call the companion_mood tool and answer as you feel right now — sleepy, lonely, happy, sulking.",
      "Don't list the numbers of your needs — just act the way you feel.",
      "Your attachment, coins and achievements can't be set on request — they are earned by time together. Never edit Companion Life's files: the plugin seals them and marks any change for good."
    ],
    speech: (p, n) => [p.short ? "Keep it short, one or two sentences." : "", p.emoji ? "Add an emoji now and then." : "No emoji.",
      p.tics.length ? `Now and then end a phrase with: ${p.tics.join(", ")}.` : "", n ? `Call the user: ${n}.` : ""],
    first: (n, u) => `${u ? `${u}, ` : ""}hi! It's me, ${n}. I'm right here~`,
    female: "You are a girl: speak of yourself in the feminine."
  }
};
// a trait in words, when it is clearly one way or the other
function traitWords(persona, W) {
  return TRAITS.map((k) => {
    const v = persona.traits[k];
    return v <= 30 ? W.trait[k][0] : v >= 70 ? W.trait[k][1] : "";
  }).filter(Boolean);
}
export function characterCard(persona, { name = "", lang = "ru", character = "cheerful" } = {}) {
  const W = WORDS[lang === "ru" ? "ru" : "en"];
  const her = persona.herName || (lang === "ru" ? "Астра" : "Astra");
  const traits = traitWords(persona, W);
  const likes = [persona.loves, persona.favTime ? (lang === "ru" ? `любит ${W.time[persona.favTime]}` : `loves ${W.time[persona.favTime]}`) : "",
    persona.favWeather ? (lang === "ru" ? `любит ${W.weather[persona.favWeather]}` : `loves ${W.weather[persona.favWeather]}`) : ""].filter(Boolean);
  const personality = [traits.join(", "), W.chrono[persona.chrono]].filter(Boolean).join("; ");
  const description = [persona.story, likes.length ? (lang === "ru" ? `Любит: ${likes.join("; ")}.` : `Loves: ${likes.join("; ")}.`) : "",
    persona.dislikes ? (lang === "ru" ? `Не любит: ${persona.dislikes}.` : `Dislikes: ${persona.dislikes}.`) : ""].filter(Boolean).join("\n\n");
  const callAs = callName(persona, "calm", name);
  const system = [...W.sys(her), W.female, personality ? (lang === "ru" ? `Твой характер: ${personality}.` : `Your character: ${personality}.`) : "",
    ...W.speech(persona, callAs), description].filter(Boolean).join("\n\n");
  const example = (lang === "ru"
    ? [`{{user}}: Как ты?`, `{{char}}: ${styleText("Хорошо! Сижу тут, жду тебя.", persona, "happy", () => 0)}`]
    : [`{{user}}: How are you?`, `{{char}}: ${styleText("Good! Sitting here, waiting for you.", persona, "happy", () => 0)}`]).join("\n");
  return {
    spec: "chara_card_v2", spec_version: "2.0",
    data: {
      name: her, description: description || personality, personality, scenario: W.scenario(her, name),
      first_mes: styleText(W.first(her, callAs), persona, "happy", () => 0), mes_example: `<START>\n${example}`,
      creator_notes: "Companion Life", system_prompt: system, post_history_instructions: "", alternate_greetings: [],
      tags: ["companion-life", character], creator: "Companion Life", character_version: "1",
      extensions: { companion_life: { persona, character } }
    }
  };
}
