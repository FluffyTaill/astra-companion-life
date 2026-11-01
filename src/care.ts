// Feeding her, a starter set of animations for a pack that has few, and her phrases for both.
import { gainBondOn, MORE_FOODS } from "./more";

// ── food ────────────────────────────────────────────────────────────────────
// fill: how much hunger it takes away; sweet: a sweet thing late at night keeps her up; drink: she
// drinks it (a drinking state, when her pack has one)
export const FOODS = {
  cookie: { ru: "печенька", en: "a cookie", ja: "クッキー", icon: "🍪", fill: 25, sweet: true },
  onigiri: { ru: "онигири", en: "an onigiri", ja: "おにぎり", icon: "🍙", fill: 45 },
  strawberry: { ru: "клубника", en: "strawberries", ja: "いちご", icon: "🍓", fill: 15, sweet: true },
  cake: { ru: "тортик", en: "a slice of cake", ja: "ケーキ", icon: "🍰", fill: 40, sweet: true },
  ramen: { ru: "рамен", en: "ramen", ja: "ラーメン", icon: "🍜", fill: 60 },
  apple: { ru: "яблоко", en: "an apple", ja: "りんご", icon: "🍎", fill: 20 },
  candy: { ru: "конфета", en: "a candy", ja: "あめ", icon: "🍬", fill: 8, sweet: true },
  tea: { ru: "чай", en: "tea", ja: "お茶", icon: "🍵", fill: 8, drink: true },
  milk: { ru: "клубничное молоко", en: "strawberry milk", ja: "いちごミルク", icon: "🥛", fill: 15, sweet: true, drink: true },
  juice: { ru: "сок", en: "juice", ja: "ジュース", icon: "🧃", fill: 10, sweet: true, drink: true },
  // treats that open with your friendship (more.ts)
  ...MORE_FOODS
};
// what she thinks of it: her personality's "loves" / "dislikes" words name it (in any language)
export function foodTaste(id, persona) {
  const f = FOODS[id];
  if (!f || !persona) return 0;
  const names = [f.ru, f.en, f.ja, id].map((x) => x.toLowerCase().replace(/^(a|an) /, ""));
  const has = (text) => {
    const t = String(text || "").toLowerCase();
    return t && names.some((n) => t.includes(n.split(" ").pop().slice(0, 5)));
  };
  return has(persona.loves) ? 1 : has(persona.dislikes) ? -1 : 0;
}

// What a meal does: refused when she is full; less hungry, happier (more for what she loves, less
// for what she does not); a sweet thing late at night wakes her up. Returns what to say.
export function feedSoul(soul, id, persona, hour, day = "") {
  const f = FOODS[id];
  if (!f) return { ok: false, key: "" };
  if (soul.hunger < 15) {
    soul.joy = Math.min(100, soul.joy + 2);
    return { ok: false, key: "full" };
  }
  const taste = foodTaste(id, persona);
  soul.hunger = Math.max(0, soul.hunger - f.fill);
  soul.joy = Math.max(0, Math.min(100, soul.joy + (taste > 0 ? 15 : taste < 0 ? -4 : 8)));
  gainBondOn(soul, taste > 0 ? 0.6 : 0.3, day);
  const late = hour >= 21 || hour < 5;
  if (f.sweet && late) soul.energy = Math.min(100, soul.energy + 15);
  return { ok: true, key: taste > 0 ? "fedLove" : taste < 0 ? "fedDislike" : f.sweet && late ? "fedNight" : "fed", drink: !!f.drink, taste };
}

// ── a starter set: free animations for the pastimes her pack has nothing for ─
// CC0 clips (free to share) the plugin downloads from its own repository on request, and two of
// Astra's own clips that need no download. Each fills a pastime only when her pack has no state
// for it. `pastime` is the id in PASTIMES (or a name the plugin looks for).
export const STARTER_BASE = "https://raw.githubusercontent.com/FluffyTaill/astra-companion-life/main/starter/";
export const STARTER_FILES = ["ual2.glb", "fm_hello.vrma", "fm_smartphone.vrma", "fm_drinkwater.vrma", "fm_cheer.vrma", "LICENSES.txt"];
export const STARTER = [
  { state: "cl_eat", file: "ual2.glb", source: "Consume", fills: ["eat", "eating", "snack", "consume"] },
  { state: "cl_drink", file: "fm_drinkwater.vrma", fills: ["drink", "drinking"] },
  { state: "cl_texting", file: "fm_smartphone.vrma", fills: ["texting", "phone_texting", "smartphone", "phone_text"] },
  { state: "cl_phone_call", file: "ual2.glb", source: "Idle_TalkingPhone_Loop", loopSecs: 8, fills: ["phone", "phone_call", "talking_phone"] },
  { state: "cl_hello", file: "fm_hello.vrma", fills: ["hello", "wave", "greeting", "hi"] },
  { state: "cl_yay", file: "fm_cheer.vrma", fills: ["as_lively_yay", "yay", "cheer_up", "excited", "joy"] },
  { state: "cl_fold_arms", file: "ual2.glb", source: "Idle_FoldArms_Loop", loopSecs: 8, fills: ["fold_arms", "sad", "sigh"] },
  { state: "cl_stretch", builtin: "builtin:nayu-anims/idle_stretch.fbx", fills: ["stretch", "stretching"] },
  { state: "cl_shy", builtin: "builtin:nayu-anims/idle_shy.fbx", fills: ["shy", "bashful", "embarrassed"] }
];
// where to get more, for what cannot be shared here
export const STARTER_LINKS = [
  { name: "Mixamo", url: "https://www.mixamo.com/", ru: "Бесплатно с аккаунтом Adobe. Ищи: Texting, Thinking, Yawn, Stretching, Happy Idle, Shy, Waving, Eating. Скачай FBX (Without Skin) и добавь в Anim Studio.",
    en: "Free with an Adobe account. Search: Texting, Thinking, Yawn, Stretching, Happy Idle, Shy, Waving, Eating. Download FBX (Without Skin) and add it in Anim Studio." },
  { name: "VRoid — VRMA Motion Pack", url: "https://booth.pm/ja/search/VRMA", ru: "Бесплатные VRMA от pixiv и авторов на BOOTH (привет, «пис», кружится…). Каждый скачивает сам — раздавать нельзя.",
    en: "Free VRMA from pixiv and creators on BOOTH (hello, peace sign, spin…). Everyone downloads them — they may not be shared." },
  { name: "Quaternius — Universal Animation Library", url: "https://quaternius.com/", ru: "CC0, сотни движений. Часть уже в стартовом наборе.",
    en: "CC0, hundreds of moves. Some are in the starter set already." }
];

// ── phrases for food (merged into the phrase book) ──────────────────────────
export const FOOD_PHRASES = {
  ru: {
    fed: { any: ["Ням! Спасибо за {food}~", "М-м, {food}! Вкусно!", "Спасибо, {name}! {food} — то, что нужно."], shy: ["Ой… спасибо за {food}…"], tsundere: ["{food}? Ну… съем, раз принёс."], lazy: ["{food}… ням… можно и вздремнуть теперь."] },
    fedLove: { any: ["{food}?! Моё любимое!! Спасибо-спасибо!", "Ты помнишь, что я люблю {food}!", "Аа, {food}! Ты лучший!"], tsundere: ["{food}… ладно, это моё любимое. Спасибо. Тихо!"] },
    fedDislike: { any: ["{food}… ну, спасибо… я съем.", "Хм, {food}… не моё, но раз ты принёс…"], tsundere: ["{food}?! Серьёзно? …Ладно, съем, но ты должен."] },
    fedNight: { any: ["{food} на ночь?.. Теперь я не усну~", "Сладкое ночью… я теперь бодрая!"] },
    full: { any: ["Я уже наелась~", "Не-не, больше не влезет!", "Спасибо, но я сытая."], tsundere: ["Ты меня раскормить решил? Я сытая!"] },
    wish_food: { any: ["Покормишь меня?", "Я бы чего-нибудь съела…", "Мм, а есть что-нибудь вкусненькое?"], shy: ["Эм… а можно мне что-нибудь поесть?.."], tsundere: ["Я не голодная! …Ну, может, чуть-чуть."] }
  },
  en: {
    fed: { any: ["Yum! Thanks for {food}~", "Mm, {food}! Tasty!", "Thank you, {name}! {food} is just right."], shy: ["Oh… thanks for {food}…"], tsundere: ["{food}? Well… I'll eat it, since you brought it."] },
    fedLove: { any: ["{food}?! My favourite!! Thank you!", "You remembered I love {food}!"], tsundere: ["{food}… fine, it's my favourite. Thanks. Hush!"] },
    fedDislike: { any: ["{food}… well, thanks… I'll eat it.", "Hm, {food}… not my thing, but since you brought it…"] },
    fedNight: { any: ["{food} at night?.. Now I won't sleep~", "Sweets at night… I'm wide awake now!"] },
    full: { any: ["I'm full already~", "No-no, not another bite!", "Thanks, but I've had enough."] },
    wish_food: { any: ["Will you feed me?", "I could eat something…", "Mm, anything tasty around?"], shy: ["Um… could I have something to eat?.."] }
  },
  ja: {
    fed: { any: ["いただきます！{food}ありがとう～", "{food}おいしい！"] },
    fedLove: { any: ["{food}！？大好物！ありがとう！"] },
    fedDislike: { any: ["{food}…うん、ありがとう…食べるね。"] },
    fedNight: { any: ["夜に{food}…もう眠れないよ～"] },
    full: { any: ["もうおなかいっぱい～"] },
    wish_food: { any: ["何か食べさせてくれる？", "おなかすいたな…"] }
  }
};
