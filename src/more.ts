// The slower parts of her life: attachment that has to be earned, coins and a little shop, her
// health, games through Astra's chat, a weekly letter, her month and year.

var clamp = (x) => Math.max(0, Math.min(100, x));

// ── attachment is earned ─────────────────────────────────────────────────────
// Everything that brings her closer goes through one daily budget, and the closer she already is,
// the less a day gives: from new to "soul mates" takes about two months of good days.
export const BOND_DAY = 3;
export function gainBondOn(s, x, day) {
  if (!(x > 0)) return s.bond;
  if (s.bondDay?.day !== day) s.bondDay = { day, got: 0 };
  const slow = Math.max(0.05, 1 - (s.bond ?? 0) / 110);
  const room = Math.max(0, BOND_DAY * slow - s.bondDay.got);
  const add = Math.min(x * slow, room);
  s.bond = clamp((s.bond ?? 0) + add);
  s.bondDay.got += add;
  return s.bond;
}

// ── coins and the shop ───────────────────────────────────────────────────────
// Coins come from time together (one per 10 minutes), granted wishes, games won. Basic food is free;
// treats and presents for her cost coins and open with the level of your friendship (0..4).
export const FOOD_SHOP = {
  cookie: { level: 0, cost: 0 }, apple: { level: 0, cost: 0 }, tea: { level: 0, cost: 0 }, onigiri: { level: 0, cost: 0 },
  candy: { level: 0, cost: 3 }, strawberry: { level: 0, cost: 5 }, juice: { level: 1, cost: 5 }, milk: { level: 1, cost: 8 },
  cake: { level: 1, cost: 15 }, ramen: { level: 2, cost: 12 }, taiyaki: { level: 2, cost: 10 }, parfait: { level: 3, cost: 25 },
  bento: { level: 4, cost: 35 }
};
export const MORE_FOODS = {
  taiyaki: { ru: "тайяки", en: "a taiyaki", ja: "たい焼き", icon: "🐟", fill: 30, sweet: true },
  parfait: { ru: "парфе", en: "a parfait", ja: "パフェ", icon: "🍨", fill: 30, sweet: true },
  bento: { ru: "домашнее бенто", en: "a home-made bento", ja: "手作り弁当", icon: "🍱", fill: 70 }
};
export const PRESENTS = {
  flower: { level: 0, cost: 15, icon: "🌸", ru: "цветочек", en: "a flower", ja: "お花" },
  ribbon: { level: 1, cost: 20, icon: "🎀", ru: "бантик", en: "a ribbon", ja: "リボン" },
  keychain: { level: 1, cost: 30, icon: "🧸", ru: "брелок-мишка", en: "a teddy keychain", ja: "くまのキーホルダー" },
  book: { level: 2, cost: 35, icon: "📚", ru: "книжка", en: "a book", ja: "本" },
  lamp: { level: 3, cost: 60, icon: "🌙", ru: "ночник-звёздочка", en: "a star night-light", ja: "星のランプ" },
  necklace: { level: 4, cost: 100, icon: "💎", ru: "кулончик", en: "a pendant", ja: "ペンダント" }
};
export function canBuy(item, level, coins) {
  if (!item) return "unknown";
  if (level < item.level) return "locked";
  if (coins < item.cost) return "coins";
  return "";
}

// ── health ──────────────────────────────────────────────────────────────────
// Long hunger or no rest wears her down; food, sleep and tea bring her back. Under 40 she is ill:
// slow, sleepy, and her words say so.
export function healthDrift(s, min, asleep) {
  let d = 0.02;
  if (s.hunger > 85) d -= 0.06;
  if (s.energy < 15) d -= 0.04;
  if (asleep) d += 0.05;
  s.health = clamp((s.health ?? 100) + d * min);
  return s.health;
}
export const sick = (s) => (s.health ?? 100) < 40;

// ── games through Astra's chat ───────────────────────────────────────────────
var RPS = ["rock", "paper", "scissors"];
var RPS_WORDS = { камень: "rock", ножницы: "scissors", бумага: "paper", rock: "rock", paper: "paper", scissors: "scissors", グー: "rock", パー: "paper", チョキ: "scissors" };
export function rps(move, rnd = Math.random) {
  const you = RPS_WORDS[String(move || "").toLowerCase().trim()] || "";
  if (!you) return null;
  const her = RPS[Math.floor(rnd() * 3)];
  const r = you === her ? "draw" : (you === "rock" && her === "scissors") || (you === "paper" && her === "rock") || (you === "scissors" && her === "paper") ? "you" : "her";
  return { you, her, result: r };
}
// guess the number she thought of (1..10): three tries
export function guess(g, n, now, rnd = Math.random) {
  if (!g || now - g.at > 10 * 60000 || g.done) g = { secret: 1 + Math.floor(rnd() * 10), tries: 0, at: now, done: false };
  if (!Number.isFinite(n)) return { game: g, answer: "start" };
  g.tries++;
  if (n === g.secret) return { game: { ...g, done: true }, answer: "right", tries: g.tries };
  if (g.tries >= 3) return { game: { ...g, done: true }, answer: "lost", secret: g.secret };
  return { game: g, answer: n < g.secret ? "higher" : "lower", left: 3 - g.tries };
}

// ── a weekly letter from her ─────────────────────────────────────────────────
var timesRu = (n) => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "раза" : "раз");
export function weekLetter(days, { lang = "ru", name = "", her = "", level = "" } = {}) {
  const sum = (k) => days.reduce((t, d) => t + (d[k] || 0), 0);
  const work = Math.round(sum("work") / 60), pats = sum("pats"), fed = sum("fed"), music = Math.round(sum("music") / 60), games = sum("played");
  const together = days.filter((d) => d.work > 30).length;
  const best = [...days].sort((a, b) => (b.pats + b.played * 2) - (a.pats + a.played * 2))[0];
  if (lang !== "ru") {
    return [`Dear ${name || "you"},`,
      `this week we spent ${together} days together${work ? `, ${work} hours at the computer` : ""}.`,
      pats ? `You patted me ${pats} times${fed ? ` and fed me ${fed} times` : ""} — I remember every one.` : "I missed your pats a little this week…",
      music ? `We listened to music for about ${music} hours. ` : "",
      games ? `And we played ${games} times!` : "",
      best?.day ? `My favourite day was ${best.day}.` : "",
      level ? `We're ${level} now. Let's have another good week.` : "Let's have another good week.",
      `— ${her || "yours"} 💌`].filter(Boolean).join("\n");
  }
  return [`${name || "Дорогой"},`,
    `за эту неделю мы были вместе ${together} дн.${work ? `, ${work} ч за компьютером` : ""}.`,
    pats ? `Ты гладил меня ${pats} ${timesRu(pats)}${fed ? ` и кормил ${fed} ${timesRu(fed)}` : ""} — я всё помню.` : "Мне немножко не хватало твоих поглаживаний…",
    music ? `Музыку слушали часа ${music}. ` : "",
    games ? `А ещё мы играли ${games} ${timesRu(games)}!` : "",
    best?.day ? `Мой любимый день — ${best.day}.` : "",
    level ? `Мы теперь ${level}. Давай и следующую неделю так же.` : "Давай и следующую неделю так же.",
    `— ${her || "твоя"} 💌`].filter(Boolean).join("\n");
}

// ── her month and year ───────────────────────────────────────────────────────
// Days leave the diary after two weeks; their numbers are folded into the month first.
export const STAT_KEYS = ["work", "pats", "naps", "music", "games", "chats", "played", "found", "late", "fed"];
export function foldDay(months, day, d) {
  const m = day.slice(0, 7);
  const t = (months[m] ||= Object.fromEntries([...STAT_KEYS, "days"].map((k) => [k, 0])));
  for (const k of STAT_KEYS) t[k] += d[k] || 0;
  if ((d.work || 0) > 10) t.days++;
  return months;
}
// a month (YYYY-MM) or a year (YYYY): what was folded plus what is still in the diary
export function statsFor(prefix, months, diary) {
  const t = Object.fromEntries([...STAT_KEYS, "days"].map((k) => [k, 0]));
  for (const [m, v] of Object.entries(months || {})) if (m.startsWith(prefix)) for (const k of Object.keys(t)) t[k] += v[k] || 0;
  for (const [day, d] of Object.entries(diary || {})) {
    if (!day.startsWith(prefix)) continue;
    for (const k of STAT_KEYS) t[k] += d[k] || 0;
    if ((d.work || 0) > 10) t.days++;
  }
  return t;
}

// ── her words for all of it ──────────────────────────────────────────────────
export const MORE_PHRASES = {
  ru: {
    woken: { any: ["Мм… ты меня разбудил… ночь же…", "Ааа… я спала… ладно, я тут.", "Зачем будить посреди ночи?.."], tsundere: ["Ты зачем меня разбудил?! …Ладно. Что?"], shy: ["Ой… я задремала… прости…"] },
    sick: { any: ["Мне что-то нехорошо…", "Я, кажется, приболела…", "Голова кружится… можно чаю?"], tsundere: ["Я не болею! …Ну, может, чуть-чуть."] },
    healed: { any: ["Мне уже лучше! Спасибо, что заботился.", "Я снова в порядке~"] },
    present: { any: ["{gift}? Это мне?! Спасибо!!", "Ааа, {gift}! Я буду беречь!", "{gift}… ты такой милый."], shy: ["{gift}… для меня?.. Спасибо…"], tsundere: ["{gift}? Ну… ладно, возьму. Спасибо. Не смотри так!"] },
    letter: { any: ["Я написала тебе письмо — оно в шкатулке 💌", "Загляни в шкатулку, там письмо от меня~"] },
    recall: { any: ["Я помню, ты говорил: «{fact}».", "Кстати… «{fact}» — я не забыла!", "Вспомнила: «{fact}». Как там с этим?"] },
    remembered: { any: ["Запомнила!", "Хорошо, я запомню~"] },
    rpsYou: { any: ["Ты выиграл! {her} проиграл твоему {you}…", "Эх, проиграла!"] },
    rpsHer: { any: ["Я победила! У меня {her}~", "Ура, моя взяла!"] },
    rpsDraw: { any: ["Ничья! Ещё раз?", "Одинаково! Давай ещё."] },
    guessStart: { any: ["Я загадала число от 1 до 10. Угадаешь за три попытки?"] },
    guessHigher: { any: ["Больше! Осталось попыток: {left}.", "Нет, бери выше~ ({left})"] },
    guessLower: { any: ["Меньше! Осталось попыток: {left}.", "Нет, пониже~ ({left})"] },
    guessRight: { any: ["Угадал! С {tries}-й попытки!", "Да! Как ты догадался?!"] },
    guessLost: { any: ["Не угадал… это было {secret}~", "Хи-хи, я загадала {secret}!"] },
    coins: { any: ["У нас накопилось {coins} монеток!"] }
  },
  en: {
    woken: { any: ["Mm… you woke me… it's night…", "Ahh… I was asleep… okay, I'm here."], tsundere: ["Why did you wake me?! …Fine. What?"] },
    sick: { any: ["I don't feel so well…", "I think I'm a bit ill…", "My head is spinning… some tea?"] },
    healed: { any: ["I feel better! Thanks for taking care of me.", "I'm fine again~"] },
    present: { any: ["{gift}? For me?! Thank you!!", "{gift}! I'll treasure it!"], shy: ["{gift}… for me?.. Thank you…"] },
    letter: { any: ["I wrote you a letter — it's in the box 💌"] },
    recall: { any: ["I remember, you said: “{fact}”.", "By the way… “{fact}” — I didn't forget!"] },
    remembered: { any: ["Got it, I'll remember!"] },
    rpsYou: { any: ["You win! My {her} lost to your {you}…"] },
    rpsHer: { any: ["I win! I had {her}~"] },
    rpsDraw: { any: ["A draw! Again?"] },
    guessStart: { any: ["I'm thinking of a number from 1 to 10. Can you guess it in three tries?"] },
    guessHigher: { any: ["Higher! Tries left: {left}."] },
    guessLower: { any: ["Lower! Tries left: {left}."] },
    guessRight: { any: ["Right! On try {tries}!"] },
    guessLost: { any: ["Nope… it was {secret}~"] },
    coins: { any: ["We've saved up {coins} coins!"] }
  },
  ja: {
    woken: { any: ["んん…起こしたの…？夜だよ…"] }, sick: { any: ["なんだか具合が悪い…"] }, healed: { any: ["元気になったよ！ありがとう。"] },
    present: { any: ["{gift}？私に？ありがとう！"] }, letter: { any: ["手紙を書いたよ、箱を見てね 💌"] }, recall: { any: ["覚えてるよ：「{fact}」"] },
    remembered: { any: ["覚えたよ！"] }, rpsYou: { any: ["負けた～！"] }, rpsHer: { any: ["勝った！"] }, rpsDraw: { any: ["あいこ！"] },
    guessStart: { any: ["1から10の数字を考えたよ。3回で当ててね！"] }, guessHigher: { any: ["もっと大きい！あと{left}回"] }, guessLower: { any: ["もっと小さい！あと{left}回"] },
    guessRight: { any: ["正解！"] }, guessLost: { any: ["残念、{secret}だったよ～"] }, coins: { any: ["コインが{coins}枚たまったよ！"] }
  }
};
