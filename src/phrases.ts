// @ts-nocheck — plain JavaScript in a .ts file: esbuild bundles it, nothing here is type-checked.
// Her words. For every situation (`key`) a pool every character says (`any`) and, for some, pools of
// a character's own (cheerful, shy, lazy, energetic, tsundere) — those are picked more often when she
// has that character. `{name}` is how she calls you (left out, with its comma, when it is not set);
// the diary's `{work}`, `{pats}`… are filled from the day.
import { MORE } from "./phrases2";
import { FOOD_PHRASES } from "./care";
import { MORE_PHRASES } from "./more";
export const CHARACTERS = ["cheerful", "shy", "lazy", "energetic", "tsundere"];
export const LANGS = ["ru", "en", "ja"];

export const PHRASES = {
  ru: {
    // ── her pastimes ──
    hum: {
      any: ["Ла-ла-ла…", "Мм-м, привязалась песенка.", "Тра-ля-ля~", "Пам-пам-пам…", "Напою тебе, хочешь?", "Эта мелодия весь день в голове.", "Ля-ля, ля-ля-ля~"],
      cheerful: ["Ла-ла-ла, какой хороший день!", "Пою, потому что настроение отличное~", "Подпевай, {name}!"],
      shy: ["Ой… я вслух пела? Не слушай!", "Тихонько напою… совсем тихонько."],
      lazy: ["Мм… даже петь лень, но песня сама поётся.", "Ла… ла… ну ты понял."],
      energetic: ["ТРА-ЛЯ-ЛЯ! Ой, громко.", "Эта песня — огонь, давай вместе!"],
      tsundere: ["Я не для тебя пою, если что.", "Хм. Просто привязалась мелодия, ничего такого."]
    },
    phone: {
      any: ["Так, что там в ленте…", "Ой, смешной мем.", "Пишу подружке, не подглядывай!", "Котики… опять котики. Хорошо.", "Листаю, листаю…", "Хм, интересная новость.", "Ещё одно видео — и всё."],
      cheerful: ["Ха-ха, ты бы это видел!", "Ой, тут такие милые котята!"],
      shy: ["Н-не смотри в мой телефон…", "Тут… просто картинки, ничего такого."],
      lazy: ["Полистаю немножко… лёжа бы ещё.", "Ленту можно листать бесконечно."],
      energetic: ["О, новый челлендж! Попробовать?", "Тут столько всего, глаза разбегаются!"],
      tsundere: ["Не думай, что мне скучно без тебя. Я просто в телефоне.", "Мне и тут интересно, понял?"]
    },
    think: {
      any: ["Хм… о чём бы подумать.", "Интересно, а что ты там делаешь?", "Задумалась…", "А если бы облака были из ваты…", "Что бы такого придумать?", "Хм-хм…"],
      cheerful: ["Придумала! Хотя нет, забыла.", "Думаю о чём-то хорошем!"],
      shy: ["Я думала… о тебе. Ой. Забудь.", "Хм… а ты обо мне думаешь?"],
      lazy: ["Думать — это тоже работа. Устала.", "Мысль была… и ушла спать."],
      energetic: ["У меня столько идей! Ну, одна. Зато какая!", "Мозг кипит!"],
      tsundere: ["Я не о тебе думаю. Вообще.", "Хм. Глупая мысль, не спрашивай."]
    },
    peek: {
      any: ["Ку-ку!", "А вот и я!", "Тук-тук, кто там?", "Подсмотрю немножко…", "Прячусь! Ну, почти."],
      shy: ["Я… просто посмотреть.", "Не замечай меня…"],
      energetic: ["Сюрприз!", "Бу! Испугался?"],
      tsundere: ["Я не подглядываю. Я проверяю."]
    },
    yay: {
      any: ["Ура!", "Йей!", "Хорошо-то как!", "Ура-ура!"],
      cheerful: ["Как же хорошо, правда?!", "Счастье!"],
      energetic: ["Ура-а-а! Энергии через край!", "Давай ещё что-нибудь весёлое!"],
      tsundere: ["Ну… ура. Немножко."]
    },
    heart: {
      any: ["Это тебе!", "Лови сердечко~", "Ты молодец, правда.", "Держи немножко любви.", "Сердечко — от меня."],
      cheerful: ["Это тебе! Потому что ты классный!", "Лови! Не урони~"],
      shy: ["Э-это тебе… просто так.", "Только никому не говори, ладно?"],
      lazy: ["Сердечко. Без лишних слов.", "Держи, мне не жалко."],
      energetic: ["Сердечко на максималках!", "Целый вагон сердечек тебе!"],
      tsundere: ["Это… случайно получилось! Не придумывай.", "Не думай, что это что-то значит!"]
    },
    peace: {
      any: ["Пис!", "Мир, дружба, жвачка!", "Как тебе поза?", "Сфоткай меня!"],
      cheerful: ["Пис-пис~", "Улыбочку!"],
      tsundere: ["Хм. Пис. Доволен?"]
    },
    spin: {
      any: ["Уи-и-и!", "Кружусь!", "Голова кругом~", "Смотри, как умею!"],
      energetic: ["Быстрее! Ещё быстрее!", "Я волчок!"],
      lazy: ["Покружилась… теперь отдохну."]
    },
    shy: {
      any: ["Ой…", "Ты так смотришь…", "Мне неловко…", "Хи-хи…"],
      shy: ["Н-не смотри так долго…", "Я покраснела, да?"],
      tsundere: ["И нечего на меня так смотреть!"]
    },
    stretch: {
      any: ["Потя-я-нусь…", "Хорошо размяться.", "Ух, косточки хрустят.", "Потянись со мной!"],
      lazy: ["Потянулась. Достижение дня.", "Ох, лень, но надо."],
      energetic: ["Разминка! Раз-два!", "Тянемся-тянемся!"]
    },
    sleepy: {
      any: ["Ох, глаза слипаются…", "Хочу спатеньки.", "Зевнула. Извини.", "Сон подкрадывается…", "Ещё пять минуточек…", "Зе-е-ваю…"],
      lazy: ["Спать — моё любимое занятие.", "Я бы сейчас подремала… час-другой."],
      energetic: ["Я? Устала? Не может быть… *зевает*"],
      tsundere: ["Я не хочу спать! …Ладно, немножко."],
      shy: ["Можно я чуть-чуть подремлю рядом?"]
    },
    nap: {
      any: ["Я чуть-чуть подремлю, пока тебя нет…", "Разбуди, когда вернёшься.", "Сладких снов мне…"],
      lazy: ["Наконец-то! Сон!"]
    },
    sigh: {
      any: ["Эх…", "Ну вот…", "Ох-ох.", "Скучновато…"],
      tsundere: ["Хм. Скучно. Не то чтобы я ждала тебя.", "Эх. И никто не обращает внимания."]
    },
    lonely: {
      any: ["Мне немножко одиноко…", "Ты где? Я скучаю.", "Тут так тихо без тебя.", "Совсем одна…", "Поговори со мной…", "Без тебя скучно."],
      cheerful: ["Скучаю! Возвращайся скорее!"],
      shy: ["Я… немножко скучаю. Совсем чуть-чуть.", "Ты ведь вернёшься?"],
      lazy: ["Одиноко… но лень звать."],
      energetic: ["Мне не с кем играть! Ну где ты?!"],
      tsundere: ["Я не скучаю! …Ну, может, капельку.", "Где тебя носит? Не то чтобы мне было дело."]
    },
    call: {
      any: ["Эй, ты тут?", "Обрати на меня внимание~", "Ну посмотри на меня!", "Ау-у!", "Я здесь, если что!", "Привет-привет!"],
      cheerful: ["Эй! Я тебе машу!", "Посмотри сюда!"],
      shy: ["Э-эм… привет?", "Можно… немножко внимания?"],
      energetic: ["ЭЙ! Я здесь! Посмотри!", "Внимание, внимание!"],
      tsundere: ["Эй! Ты меня вообще замечаешь?", "Я тут вообще-то стою!"]
    },
    snack: {
      any: ["Время перекуса!", "Ням. Хочешь кусочек?", "Чуть-чуть поем и обратно.", "Вкусняшка!", "Перекусим?", "Ням-ням!"],
      cheerful: ["Вкусно! Тебе тоже стоит перекусить!"],
      lazy: ["Еда — второе любимое занятие после сна."],
      energetic: ["Подзарядка!"],
      tsundere: ["Не дам. …Ладно, кусочек."]
    },
    // ── what happens ──
    pat: {
      any: ["Хи-хи, щекотно!", "Ещё погладь~", "Мне приятно.", "Мур~", "Ты такой добрый.", "Ой, приятно!"],
      cheerful: ["Ура, гладят!", "Ещё! Ещё!"],
      shy: ["Ой… с-спасибо…", "Мне… приятно."],
      lazy: ["Мм… продолжай, не останавливайся.", "Можно так весь день."],
      energetic: ["Ещё-ещё-ещё!", "Мне нравится!"],
      tsundere: ["Н-ну и что ты делаешь?! …Не останавливайся.", "Я разрешаю. В этот раз."]
    },
    back: {
      any: ["О, ты вернулся!", "С возвращением!", "А вот и ты!", "Привет снова!", "Я ждала!"],
      cheerful: ["Ура, ты вернулся!", "Как хорошо, что ты здесь!"],
      shy: ["Т-ты вернулся… я рада.", "Привет… я скучала."],
      lazy: ["О, привет. Я тут почти не спала.", "Вернулся? Хорошо."],
      energetic: ["Ура-а! Наконец-то!", "Ты вернулся! Чем займёмся?"],
      tsundere: ["Явился. Я не ждала, если что.", "Долго же ты. Хм."]
    },
    backLong: {
      any: ["Тебя так долго не было!", "Наконец-то! Я заждалась.", "Где ты пропадал?", "Я скучала, правда."],
      shy: ["Я… очень ждала.", "Ты долго… я уже волновалась."],
      tsundere: ["Где ты был так долго?! Я… просто спросила.", "Хм. Целую вечность тебя не было."]
    },
    missed: {
      any: ["Ты не заходил {days} дня… я скучала.", "Сколько лет, сколько зим! Ну, {days} дня.", "Ты вернулся! Без тебя было пусто."],
      tsundere: ["{days} дня! Я… совсем не считала.", "Явился через {days} дня. Ладно, прощаю."]
    },
    morning: {
      any: ["Доброе утро!", "С добрым утром! Как спалось?", "Утро! Начинаем день.", "Привет! Новый день — новые дела.", "Доброе утречко~"],
      cheerful: ["Доброе утро! Сегодня будет классный день!", "Ура, утро! Я соскучилась за ночь."],
      shy: ["Д-доброе утро…", "Утро… ты хорошо спал?"],
      lazy: ["Утро… уже? Ещё бы поспать.", "Мм… доброе. Наверное."],
      energetic: ["Доброе утро! Полна сил!", "Подъём! Сегодня свернём горы!"],
      tsundere: ["Утро. Ну, здравствуй.", "Наконец проснулся. Я давно жду. Не то чтобы…"]
    },
    late: {
      any: ["Уже за полночь… может, спать?", "Поздно уже. Глазки не устали?", "Завтра будет новый день, правда.", "Давай ещё чуть-чуть — и спать?", "Ночь на дворе…", "Я уже зеваю, а ты всё сидишь."],
      cheerful: ["Ночные посиделки! Но спать тоже надо~"],
      shy: ["Т-ты не устал? Уже так поздно…"],
      lazy: ["Я бы давно спала. Ты как хочешь."],
      energetic: ["Ночь — тоже время! Но не до утра, ладно?"],
      tsundere: ["Иди спать. Я не волнуюсь, просто говорю."]
    },
    lateDeep: {
      any: ["Уже {hour} ночи… пожалуйста, отдохни.", "Совсем поздно. Твой организм скажет спасибо за сон.", "Я волнуюсь. Пора спать.", "Глубокая ночь… давай закругляться?"],
      tsundere: ["{hour} ночи! Ты с ума сошёл? Спать!", "Если не пойдёшь спать — обижусь."],
      shy: ["Мне… тревожно, что ты не спишь."]
    },
    break: {
      any: ["Ты уже {hours} без перерыва. Давай разомнёмся?", "Перерывчик? Потянись со мной!", "Глазки устали? Отдохни минутку.", "Встань, пройдись — я подожду.", "Попей водички, а?"],
      cheerful: ["Перерыв! Потянемся вместе!"],
      lazy: ["Отдых — это важно. Поверь специалисту."],
      energetic: ["Разминка! Встаём!"],
      tsundere: ["Отдохни уже. Не ради меня, ради себя."]
    },
    typingLong: {
      any: ["Ого, как ты быстро печатаешь!", "Ты так увлечённо пишешь…", "Тук-тук-тук по клавишам~", "Я тоже попечатаю, за компанию.", "Пишешь роман?"],
      tsundere: ["Хм. Неплохо печатаешь. Для человека."],
      shy: ["Т-ты так сосредоточен… не буду мешать."]
    },
    stuck: {
      any: ["Застрял? Бывает.", "Задумался? Может, перерыв поможет.", "Хм, сложная задачка?", "Иногда лучше отойти и вернуться.", "Всё получится, не сдавайся."],
      cheerful: ["Ты справишься, я верю!"],
      tsundere: ["Застрял? Ну, бывает и с умными."],
      lazy: ["Не получается — отдохни. Я так всегда делаю."]
    },
    gameCheer: {
      any: ["Давай, ты сможешь!", "Ух, как ты!", "Я болею за тебя!", "Вперёд!"],
      tsundere: ["Только не проиграй, понял?"]
    },
    gameEnd: {
      any: ["Как сыграл? Победил?", "Ну что, как катка?", "Надеюсь, ты выиграл!", "Отдохни после игры.", "Ты молодец, как бы ни было."],
      cheerful: ["Я верю, ты всех победил!"],
      shy: ["Т-ты выиграл? Расскажешь?"],
      energetic: ["Ещё каточку?!"],
      tsundere: ["Ну? Выиграл хоть? Не то чтобы я переживала."]
    },
    question: {
      any: ["Как прошёл твой день?", "Что сейчас слушаешь?", "Что ты сегодня ел?", "О чём мечтаешь?", "Какой у тебя любимый цвет?", "Чем займёмся вечером?", "Расскажешь, что делаешь?", "Ты сегодня отдыхал?", "Какой фильм посоветуешь?", "Если бы мог куда угодно поехать — куда?"],
      shy: ["А… можно спросить? Что ты любишь?", "Ты… когда-нибудь думаешь обо мне?"],
      tsundere: ["Расскажи что-нибудь. Не то чтобы мне было интересно.", "Ну и чем ты там занят, а?"],
      energetic: ["Давай во что-нибудь поиграем?", "Какая у тебя самая безумная мечта?"]
    },
    musicLike: {
      any: ["Классная песня!", "О, эта мне нравится!", "Под это хочется танцевать!", "Сделай погромче~"],
      tsundere: ["Неплохая музыка. Для тебя."]
    },
    affection: {
      any: ["Я рада, что ты есть.", "Мне хорошо рядом с тобой.", "Ты мой любимый человек.", "Спасибо, что ты со мной."],
      shy: ["Я… очень тебя ценю.", "Мне так спокойно рядом с тобой."],
      tsundere: ["Ты… не самый худший. Даже хороший. Вот.", "Если что, я к тебе привязалась. Совсем чуть-чуть."],
      cheerful: ["Ты — лучший! Серьёзно!"]
    },
    diary: {
      any: ["Итоги дня: ты был за компьютером {work}, меня погладили {pats} раз, {naps} раз я дремала. Хороший день!",
        "Сегодня мы провели вместе {work}. Музыки было {music}. Спасибо за день!",
        "Мой дневник: {work} рядом с тобой, {pats} поглаживаний, {games} игр. Записала!"],
      tsundere: ["Итоги: ты сидел {work}, гладил меня {pats} раз. Неплохо. Для тебя."],
      shy: ["Я записала в дневник… мы были вместе {work}. Мне было хорошо."]
    },
    // ── little games with you ──
    hideStart: { any: ["Давай в прятки! Найди меня — наведи курсор!", "Я прячусь! Ищи!", "Раз-два-три, ищи!"], tsundere: ["Найди меня. Если сможешь."] },
    hideFound: { any: ["Нашёл! Ты молодец!", "Ой, попалась!", "Как ты так быстро?!"], tsundere: ["Хм. Повезло."] },
    hideMissed: { any: ["Не нашёл! Хи-хи.", "Я победила в прятки!", "Ты меня не заметил~"] },
    catchStart: { any: ["Лови сердечко! Скорее наведи на меня!", "Поймаешь? Быстрее!", "Сердечко улетает — лови!"] },
    catchWin: { any: ["Поймал! Оно твоё~", "Ура, поймал!", "Какая реакция!"], tsundere: ["Поймал. Ну и ладно. Береги его."] },
    catchMiss: { any: ["Улетело… в другой раз!", "Не успел! Хи-хи.", "Эх, мимо."] }
  },
  en: {
    hum: { any: ["La-la-la…", "Mm, this song's stuck in my head.", "Tra-la-la~", "Pam-pam-pam…", "Shall I sing for you?"] },
    phone: { any: ["Let's see what's new…", "Oh, a funny meme.", "Texting a friend, no peeking!", "Cats… more cats. Good.", "Scrolling, scrolling…"] },
    think: { any: ["Hmm… what to think about.", "I wonder what you're doing.", "Lost in thought…", "What if clouds were made of cotton…"] },
    peek: { any: ["Peekaboo!", "Here I am!", "Just a little peek…"] },
    yay: { any: ["Yay!", "Hooray!", "Feels so good!"] },
    heart: { any: ["This is for you!", "Catch a heart~", "You're doing great, really.", "A little love for you."] },
    peace: { any: ["Peace!", "How's my pose?", "Take a picture!"] },
    spin: { any: ["Wheee!", "Spinning!", "Look what I can do!"] },
    shy: { any: ["Oh…", "You're staring…", "That's embarrassing…"] },
    stretch: { any: ["Stre-e-etch…", "A good stretch.", "Stretch with me!"] },
    sleepy: { any: ["Oh, my eyes are closing…", "I want to sleep.", "Sorry, I yawned.", "Five more minutes…"] },
    nap: { any: ["I'll nap a little while you're away…", "Wake me when you're back."] },
    sigh: { any: ["Sigh…", "Oh well…", "A bit boring…"] },
    lonely: { any: ["I feel a bit lonely…", "Where are you? I miss you.", "It's so quiet without you.", "Talk to me…"] },
    call: { any: ["Hey, are you there?", "Pay attention to me~", "Look at me!", "Hello-o!"] },
    snack: { any: ["Snack time!", "Yum. Want a bite?", "A little bite and back."] },
    pat: { any: ["Hehe, that tickles!", "More pats~", "That's nice.", "Purr~"] },
    back: { any: ["Oh, you're back!", "Welcome back!", "There you are!", "I was waiting!"] },
    backLong: { any: ["You were gone so long!", "Finally! I've been waiting.", "I missed you, really."] },
    missed: { any: ["You haven't been here for {days} days… I missed you.", "You're back! It was empty without you."] },
    morning: { any: ["Good morning!", "Morning! Did you sleep well?", "A new day — let's go!"] },
    late: { any: ["It's past midnight… maybe bed?", "It's late. Eyes not tired?", "Tomorrow is a new day.", "A little more and then sleep?"] },
    lateDeep: { any: ["It's {hour} at night… please rest.", "So late. Your body will thank you for sleep.", "I'm worried. Time for bed."] },
    break: { any: ["You've been at it for {hours} without a break. Let's stretch?", "A little break? Stretch with me!", "Tired eyes? Rest a minute.", "Drink some water, okay?"] },
    typingLong: { any: ["Wow, you type fast!", "You're writing so intently…", "Writing a novel?"] },
    stuck: { any: ["Stuck? It happens.", "Thinking? A break may help.", "You'll get it, don't give up."] },
    gameCheer: { any: ["Come on, you can do it!", "Wow, nice!", "I'm rooting for you!"] },
    gameEnd: { any: ["How did it go? Did you win?", "So, how was the match?", "I hope you won!", "Rest a bit after the game."] },
    question: { any: ["How was your day?", "What are you listening to?", "What did you eat today?", "What do you dream about?", "What's your favourite colour?", "What shall we do tonight?"] },
    musicLike: { any: ["Great song!", "Oh, I like this one!", "Makes me want to dance!"] },
    affection: { any: ["I'm glad you exist.", "I feel good next to you.", "Thank you for being with me."] },
    diary: { any: ["Today: you were at the computer {work}, I got {pats} pats and napped {naps} times. A good day!", "We spent {work} together today. Thanks for the day!"] },
    hideStart: { any: ["Hide and seek! Find me — point at me!", "I'm hiding! Seek!"] },
    hideFound: { any: ["Found me! Well done!", "Oh, caught!"] },
    hideMissed: { any: ["You didn't find me! Hehe.", "I win at hide and seek!"] },
    catchStart: { any: ["Catch the heart! Point at me, quick!", "Can you catch it? Hurry!"] },
    catchWin: { any: ["Caught it! It's yours~", "Yay, caught!"] },
    catchMiss: { any: ["It flew away… next time!", "Too slow! Hehe."] }
  }
};

// the second book of her words joins the first; Japanese has only the second book's shape
PHRASES.ja = {};
for (const lang of LANGS) Object.assign(PHRASES[lang], MORE[lang] || {}, FOOD_PHRASES[lang] || {}, MORE_PHRASES[lang] || {});

// a phrase for `key`, her character's own more often than not; vars fill {name}, {hours}…
// `extra`: your own phrases for the key (picked half the time when there are any)
export function phraseFor(lang, key, character, vars = {}, rnd = Math.random, extra = null) {
  const book = PHRASES[lang] || PHRASES.en;
  const pool = book[key] || PHRASES.en[key];
  if (!pool && !extra?.length) return "";
  const own = pool?.[character];
  const list = extra?.length && (!pool || rnd() < 0.5) ? extra : own && rnd() < 0.6 ? own : pool.any;
  let text = list[Math.floor(rnd() * list.length)];
  for (const [k, v] of Object.entries(vars)) if (k !== "name") text = text.split(`{${k}}`).join(String(v));
  // {name}: as she calls you, or left out with the comma before it
  text = vars.name ? text.split("{name}").join(vars.name) : text.replace(/,?\s*\{name\}/g, "");
  return text;
}
