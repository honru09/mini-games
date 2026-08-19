

/* ================= i18n 国际化框架 ================= */
const LOCALES = {};
let currentLocale = {};
let currentLang = 'zh-CN';
let languageRequestSequence = 0;
const SUPPORTED_LANGUAGES = ['zh-CN','en-US','uk-UA'];

/* Common labels generated at runtime by legacy/game modules. */
const RUNTIME_I18N = {
  '切换主题': { 'en-US':'Switch theme', 'uk-UA':'Змінити тему' }, '当前：': { 'en-US':'Current: ', 'uk-UA':'Поточна: ' },
  '知道了': { 'en-US':'Got it', 'uk-UA':'Зрозуміло' }, '快速开局': { 'en-US':'Quick start', 'uk-UA':'Швидкий старт' },
  '选择玩家人数': { 'en-US':'Choose player count', 'uk-UA':'Оберіть кількість гравців' }, '游戏模式': { 'en-US':'Game mode', 'uk-UA':'Режим гри' },
  '未连接': { 'en-US':'Disconnected', 'uk-UA':'Не підключено' }, '人数': { 'en-US':'Players', 'uk-UA':'Гравці' },
  '未选择': { 'en-US':'Not selected', 'uk-UA':'Не обрано' }, '等待': { 'en-US':'Waiting', 'uk-UA':'Очікування' },
  '你的回合': { 'en-US':'Your turn', 'uk-UA':'Ваш хід' }, '等待对方': { 'en-US':'Waiting for opponent', 'uk-UA':'Очікування суперника' },
  '玩家': { 'en-US':'Player', 'uk-UA':'Гравець' }, '获胜': { 'en-US':'wins', 'uk-UA':'перемагає' }, '平局': { 'en-US':'Draw', 'uk-UA':'Нічия' },
  '观战': { 'en-US':'Spectating', 'uk-UA':'Перегляд' }, '比赛结束': { 'en-US':'Match over', 'uk-UA':'Матч завершено' }, '思考中': { 'en-US':'Thinking', 'uk-UA':'Думає' },
  '已吃': { 'en-US':'Captured', 'uk-UA':'Збито' }, '棋钟用尽': { 'en-US':'Time expired', 'uk-UA':'Час вичерпано' },
  '同步开局': { 'en-US':'Synchronized start', 'uk-UA':'Синхронний старт' },
  '实时坦克竞技': { 'en-US':'Real-time tank arena', 'uk-UA':'Танкова арена в реальному часі' }, '实时坦克竞技获胜': { 'en-US':'Won the real-time tank arena', 'uk-UA':'Перемога на танковій арені' },
  '生存战获胜': { 'en-US':'Survival battle won', 'uk-UA':'Перемога в битві на виживання' }, '秒': { 'en-US':'s', 'uk-UA':'с' }, '分': { 'en-US':'pts', 'uk-UA':'очк.' }, '局': { 'en-US':'games', 'uk-UA':'ігор' },
  '主题：': { 'en-US':'Theme: ', 'uk-UA':'Тема: ' },
  '已选择 AI 对手：': { 'en-US':'AI opponent selected: ', 'uk-UA':'Обрано суперника ШІ: ' }, '账号创建成功，欢迎 ': { 'en-US':'Account created. Welcome, ', 'uk-UA':'Обліковий запис створено. Вітаємо, ' },
  '登录成功：': { 'en-US':'Logged in: ', 'uk-UA':'Вхід виконано: ' }, '链接已复制，发送给朋友即可加入': { 'en-US':'Link copied — send it to a friend to join', 'uk-UA':'Посилання скопійовано — надішліть другу для приєднання' },
  '已连接服务器，可创建或加入房间': { 'en-US':'Connected — create or join a room', 'uk-UA':'Підключено — створіть кімнату або приєднайтеся' },
  '连接已断开': { 'en-US':'Disconnected', 'uk-UA':'З’єднання втрачено' },
  '连接失败，请确认服务已启动': { 'en-US':'Connection failed. Check that the service is running', 'uk-UA':'Не вдалося підключитися. Перевірте роботу сервісу' },
  '正在创建房间…': { 'en-US':'Creating room…', 'uk-UA':'Створення кімнати…' },
  '正在连接服务器…': { 'en-US':'Connecting…', 'uk-UA':'Підключення…' },
  '正在加入房间 ': { 'en-US':'Joining room ', 'uk-UA':'Приєднання до кімнати ' },
  '房间已创建：': { 'en-US':'Room created: ', 'uk-UA':'Кімнату створено: ' },
  '，等待对方加入…': { 'en-US':'; waiting for players…', 'uk-UA':'; очікування гравців…' },
  '已加入房间 ': { 'en-US':'Joined room ', 'uk-UA':'Приєднано до кімнати ' },
  '，等待房主开始…': { 'en-US':'; waiting for the host…', 'uk-UA':'; очікування організатора…' },
  '登录会话已失效，请使用 PIN 重新登录': { 'en-US':'Your session expired. Sign in again with your PIN', 'uk-UA':'Сеанс завершився. Увійдіть знову за PIN' },
  '请先创建账号或登录后再联机': { 'en-US':'Create an account or sign in before playing online', 'uk-UA':'Створіть обліковий запис або увійдіть для онлайн-гри' },
  '请先连接服务器后再登录': { 'en-US':'Connect to the server before signing in', 'uk-UA':'Підключіться до сервера перед входом' },
  '请输入房间码': { 'en-US':'Enter a room code', 'uk-UA':'Введіть код кімнати' },
  '对局进行中…': { 'en-US':'Match in progress…', 'uk-UA':'Матч триває…' },
  '等待房主选择游戏…': { 'en-US':'Waiting for the host to choose a game…', 'uk-UA':'Очікування вибору гри організатором…' },
  '房主已选择 ': { 'en-US':'Host selected ', 'uk-UA':'Організатор обрав ' },
  '，即将开始…': { 'en-US':'; starting soon…', 'uk-UA':'; скоро початок…' },
  '，等待更多玩家…': { 'en-US':'; waiting for more players…', 'uk-UA':'; очікування інших гравців…' },
  ' 的房间': { 'en-US':'\'s room', 'uk-UA':' — кімната' },
  '🎮 返回对局': { 'en-US':'🎮 Return to match', 'uk-UA':'🎮 Повернутися до матчу' },
  '▶ 开始游戏': { 'en-US':'▶ Start game', 'uk-UA':'▶ Почати гру' },
  '📨 邀请玩家': { 'en-US':'📨 Invite players', 'uk-UA':'📨 Запросити гравців' },
  '离开房间': { 'en-US':'Leave room', 'uk-UA':'Вийти з кімнати' },
  '已离开房间': { 'en-US':'Left the room', 'uk-UA':'Ви вийшли з кімнати' },
  '邀请玩家加入房间': { 'en-US':'Invite players to the room', 'uk-UA':'Запросити гравців до кімнати' },
  '当前没有其他在线玩家': { 'en-US':'No other players are online', 'uk-UA':'Інших гравців онлайн немає' },
  '操作失败': { 'en-US':'Operation failed', 'uk-UA':'Операція не вдалася' }, '出错了': { 'en-US':'Something went wrong', 'uk-UA':'Сталася помилка' },
  '🤖 AI 思考中…': { 'en-US':'🤖 AI is thinking…', 'uk-UA':'🤖 ШІ думає…' },
  '由房主开始新一局': { 'en-US':'Only the host can start a new match', 'uk-UA':'Новий матч може почати лише організатор' },
  '由房主结束本局': { 'en-US':'Only the host can end this match', 'uk-UA':'Завершити матч може лише організатор' },
  '只有房主可以提前结算': { 'en-US':'Only the host can end the match early', 'uk-UA':'Лише організатор може достроково завершити матч' },
  '服务器正在掷骰并结算…': { 'en-US':'The server is rolling and resolving the move…', 'uk-UA':'Сервер кидає кубики та обробляє хід…' },
  '服务器正在处理「': { 'en-US':'Server is processing “', 'uk-UA':'Сервер обробляє «' },
  '」…': { 'en-US':'”…', 'uk-UA':'»…' },
  '🎲 掷骰子': { 'en-US':'🎲 Roll dice', 'uk-UA':'🎲 Кинути кубики' },
  '⏹ 提前结算': { 'en-US':'⏹ End early', 'uk-UA':'⏹ Завершити достроково' },
  '购买 ¥': { 'en-US':'Buy ¥', 'uk-UA':'Купити ¥' }, '放弃并拍卖': { 'en-US':'Pass and auction', 'uk-UA':'Відмовитися й провести аукціон' },
  '放弃': { 'en-US':'Pass', 'uk-UA':'Відмовитися' }, '出价 ¥': { 'en-US':'Bid ¥', 'uk-UA':'Ставка ¥' },
  '资金不足，无法购买': { 'en-US':'Not enough cash to buy', 'uk-UA':'Недостатньо коштів для купівлі' },
  '正在开启「': { 'en-US':'Opening the auction for “', 'uk-UA':'Відкриття аукціону для «' },
  '」实时拍卖…': { 'en-US':'” …', 'uk-UA':'»…' },
  '机会卡': { 'en-US':'Chance card', 'uk-UA':'Картка шансу' }, '翻牌中…': { 'en-US':'Revealing…', 'uk-UA':'Відкриття…' },
  '经过起点': { 'en-US':'Passed Start', 'uk-UA':'Пройдено старт' }, '直达起点': { 'en-US':'Go directly to Start', 'uk-UA':'Прямо на старт' },
  '现金变化': { 'en-US':'Cash change', 'uk-UA':'Зміна коштів' }, '缴纳了 ': { 'en-US':'paid ', 'uk-UA':'сплачено ' },
  ' 税款': { 'en-US':' tax', 'uk-UA':' податку' }, '支付租金 ': { 'en-US':' paid rent ', 'uk-UA':' сплатив оренду ' },
  '回到自己的地盘': { 'en-US':'landed on their own property', 'uk-UA':'потрапив на власну ділянку' },
  '破产出局': { 'en-US':'is bankrupt', 'uk-UA':'збанкрутував' }, '破产': { 'en-US':'Bankrupt', 'uk-UA':'Банкрут' },
  '领先：': { 'en-US':'Leader: ', 'uk-UA':'Лідер: ' }, '净资产': { 'en-US':'Net worth', 'uk-UA':'Чисті активи' },
  '无地产': { 'en-US':'No properties', 'uk-UA':'Немає нерухомості' }, '自己的地盘': { 'en-US':'own property', 'uk-UA':'власна ділянка' },
  '红方已吃：': { 'en-US':'Red captured: ', 'uk-UA':'Червоні взяли: ' }, '黑方已吃：': { 'en-US':'Black captured: ', 'uk-UA':'Чорні взяли: ' },
  '红方 ': { 'en-US':'Red ', 'uk-UA':'Червоні ' }, '黑方 ': { 'en-US':'Black ', 'uk-UA':'Чорні ' },
  '轮到玩家1，点击棋子走棋': { 'en-US':'Player 1: select a piece', 'uk-UA':'Гравець 1: виберіть фігуру' },
  ' · ⚠️ 将军': { 'en-US':' · ⚠️ Check', 'uk-UA':' · ⚠️ Шах' }, '被将军！请应将': { 'en-US':'is in check — respond', 'uk-UA':'під шахом — захищайтеся' },
  '点击棋盘落子': { 'en-US':'click the board to place a stone', 'uk-UA':'натисніть на дошку, щоб зробити хід' },
  '等待对方落子…': { 'en-US':'Waiting for opponent…', 'uk-UA':'Очікування ходу суперника…' },
  '棋盘已满，平局': { 'en-US':'Board full — draw', 'uk-UA':'Дошка заповнена — нічия' },
  '五子连线': { 'en-US':'Five in a row', 'uk-UA':'П’ять у ряд' }, '象棋获胜': { 'en-US':'Chinese chess victory', 'uk-UA':'Перемога в китайських шахах' },
  '服务端最终排名': { 'en-US':'server final ranking', 'uk-UA':'фінальний рейтинг сервера' },
  '生存到最后': { 'en-US':'survived to the end', 'uk-UA':'вижив до кінця' },
  '同步生存战': { 'en-US':'Synchronized survival', 'uk-UA':'Синхронне виживання' },
  '创建账号或使用 PIN 登录': { 'en-US':'Create an account or sign in with PIN', 'uk-UA':'Створіть обліковий запис або увійдіть за PIN' },
  '查看我的档案': { 'en-US':'View my profile', 'uk-UA':'Переглянути мій профіль' },
  '点击设置档案': { 'en-US':'Click to set profile', 'uk-UA':'Натисніть, щоб налаштувати профіль' },
  '＋ 新建档案': { 'en-US':'＋ New profile', 'uk-UA':'＋ Новий профіль' }, '新建档案': { 'en-US':'New profile', 'uk-UA':'Новий профіль' },
  '编辑档案': { 'en-US':'Edit profile', 'uk-UA':'Редагувати профіль' }, '输入昵称（12 字以内）': { 'en-US':'Nickname (up to 12 characters)', 'uk-UA':'Псевдонім (до 12 символів)' },
  '选择头像（0-29 免费，30+ 商城）': { 'en-US':'Choose avatar (0–29 free, 30+ in shop)', 'uk-UA':'Оберіть аватар (0–29 безкоштовно, 30+ у магазині)' },
  '背景': { 'en-US':'Background', 'uk-UA':'Тло' }, '昵称效果': { 'en-US':'Name effect', 'uk-UA':'Ефект імені' },
  '保存': { 'en-US':'Save', 'uk-UA':'Зберегти' }, '取消': { 'en-US':'Cancel', 'uk-UA':'Скасувати' }, '确定': { 'en-US':'OK', 'uk-UA':'Гаразд' }
};
const RUNTIME_I18N_PATTERNS = {
  'en-US': [
    [/第\s*(\d+)\s*\/(\d+)\s*轮/g, 'Round $1/$2'],
    [/轮到玩家\s*(\d+)/g, 'Player $1\'s turn'],
    [/玩家\s*(\d+)\s*的回合/g, 'Player $1\'s turn'],
    [/玩家\s*(\d+)\s*获胜/g, 'Player $1 wins'],
    [/玩家\s*(\d+)\s*被将军！请应将/g, 'Player $1 is in check — respond'],
    [/玩家\s*(\d+)/g, 'Player $1'],
    [/(\d+)\s*人存活/g, '$1 alive'],
    [/(\d+)\s*人/g, 'Players: $1'], [/(\d+)\s*局/g, 'Games: $1'],
    [/(\d+)\s*分/g, '$1 pts'], [/(\d+)\s*行/g, '$1 lines'], [/(\d+)\s*秒/g, '$1 s'],
  ],
  'uk-UA': [
    [/第\s*(\d+)\s*\/(\d+)\s*轮/g, 'Тур $1/$2'],
    [/轮到玩家\s*(\d+)/g, 'Хід гравця $1'],
    [/玩家\s*(\d+)\s*的回合/g, 'Хід гравця $1'],
    [/玩家\s*(\d+)\s*获胜/g, 'Гравець $1 перемагає'],
    [/玩家\s*(\d+)\s*被将军！请应将/g, 'Гравець $1 під шахом — захищайтеся'],
    [/玩家\s*(\d+)/g, 'Гравець $1'],
    [/(\d+)\s*人存活/g, '$1 у грі'],
    [/(\d+)\s*人/g, 'Гравців: $1'], [/(\d+)\s*局/g, 'Матчів: $1'],
    [/(\d+)\s*分/g, '$1 очк.'], [/(\d+)\s*行/g, '$1 ліній'], [/(\d+)\s*秒/g, '$1 с'],
  ],
};
function translateRuntime(text) {
  if (typeof text !== 'string' || currentLang === 'zh-CN') return text;
  let out = text;
  (RUNTIME_I18N_PATTERNS[currentLang] || []).forEach(([pattern,replacement]) => { out = out.replace(pattern,replacement); });
  Object.keys(RUNTIME_I18N).sort((a,b)=>b.length-a.length).forEach(src => { const dst = RUNTIME_I18N[src][currentLang]; if (dst) out = out.split(src).join(dst); });
  return out;
}

const SERVER_MESSAGE_KEYS = {
  'PIN 只能使用字母和数字，长度 4-20 位':'pin_invalid',
  'PIN 只能包含字母和数字，长度 4-20 位':'pin_invalid',
  '余额不足，请完成有效对局获取 💵':'shop_insufficient',
  'G Coins 余额不足，请完成有效对局获取 G Coins':'shop_insufficient',
  '余额不足，先去赢几局吧':'shop_insufficient',
  '只有房主可以提前结算':'host_only_settle',
  '房间不存在':'server_room_not_found',
  '对局已开始':'server_match_started',
  '房间已满':'server_room_full',
  '你已在房间中':'server_already_in_room',
  '同一账号不能重复加入同一房间':'server_duplicate_room_account',
  '观战模式为只读，不能发送游戏输入':'server_spectator_readonly',
  '已占用玩家席位，不能同时观战':'server_player_cannot_spectate',
  '请先退出当前观战房间':'server_leave_spectator_first',
  '对局尚未开始':'server_match_not_started',
  '当前无法加入观众席':'server_spectator_unavailable',
  '受邀玩家不存在':'server_invitee_missing',
  '请等待掉线玩家恢复连接后再开始':'server_wait_reconnect_start',
  '走子消息过大':'server_move_too_large',
};
const SERVER_REASON_KEYS = Object.fromEntries([
  'account_is_player','account_spectating','already_spectating','consent_closed','consent_required','cross_room_join',
  'duplicate_pairing','duplicate_result','duplicate_spectator_identity','duplicate_tournament','game_mismatch','game_not_allowed',
  'invalid_identity','invalid_match','invalid_match_id','invalid_pairing','invalid_participants','invalid_status','invalid_tournament',
  'invalid_tournament_id','match_already_bound','match_mismatch','match_not_bound','match_not_started','not_participant',
  'owner_capacity','owner_only','pairing_not_found','pairings_incomplete','participant_declined','participant_limit',
  'players_mismatch','snapshot_not_ready','spectator_active','spectator_capacity','tournament_capacity','tournament_not_found',
  'untrusted_result_source','tournament_requires_3_players','duplicate_participant','server_result_required',
].map(reason => [reason, 'server_reason_' + reason]));
function translateServerMessage(message, reason, fallbackKey) {
  const fallback = fallbackKey || 'operation_failed';
  const normalizedReason = String(reason || '').trim();
  if (normalizedReason) {
    const reasonToken = normalizedReason.replace(/[^a-z0-9_]/gi,'').toLowerCase();
    const reasonKey = SERVER_REASON_KEYS[normalizedReason] || SERVER_REASON_KEYS[reasonToken] || ('server_reason_' + reasonToken);
    const localizedReason = t(reasonKey);
    if (localizedReason !== reasonKey) return localizedReason;
  }
  const text = String(message || '').trim();
  const exactKey = SERVER_MESSAGE_KEYS[text];
  if (exactKey) return t(exactKey);
  let match = /^该游戏最多支持\s*(\d+)\s*人，当前已加入\s*(\d+)\s*人$/.exec(text);
  if (match) return t('server_game_capacity',match[1],match[2]);
  match = /^当前已选择的游戏最多支持\s*(\d+)\s*人$/.exec(text);
  if (match) return t('server_selected_game_capacity',match[1]);
  const suffixReason = /[：:]([a-z][a-z0-9_]*)$/i.exec(text);
  if (suffixReason) {
    const reasonToken = suffixReason[1].toLowerCase();
    const reasonKey = SERVER_REASON_KEYS[suffixReason[1]] || SERVER_REASON_KEYS[reasonToken] || ('server_reason_' + reasonToken);
    const localizedReason = t(reasonKey);
    if (localizedReason !== reasonKey) return t('server_error_with_reason',localizedReason);
  }
  if (currentLang === 'zh-CN' && text) return text;
  return t(fallback);
}

/* Keep the source text for legacy/runtime nodes so switching from one
 * non-Chinese locale to another never translates an already translated value. */
const I18N_TEXT_SOURCES = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
const I18N_ATTRIBUTE_SOURCES = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
const I18N_RENDERED_VALUES = new Map();
function rememberRenderedSource(text, source) {
  const value = String(text);
  if (I18N_RENDERED_VALUES.size >= 4096 && !I18N_RENDERED_VALUES.has(value)) {
    const oldest = I18N_RENDERED_VALUES.keys().next().value;
    I18N_RENDERED_VALUES.delete(oldest);
  }
  I18N_RENDERED_VALUES.set(value, source);
}
function rememberRenderedTranslation(text, key, args) {
  rememberRenderedSource(text, { key, args: args.slice() });
}
function localizeRenderedSource(source) {
  if (!source || typeof source !== 'object') return source;
  const args = Array.isArray(source.args) ? source.args : [];
  if (source.kind === 'plural') return tPlural(source.key, ...args);
  if (source.kind === 'game_record') return formatGameRecord(...args);
  if (source.kind === 'mastery_journey_goal') return formatMasteryJourneyGoal(...args);
  if (source.kind === 'mastery_next_hint') return formatMasteryNextHint(...args);
  return source.key ? t(source.key, ...args) : '';
}
function rememberRuntimeText(node, source) {
  if (!I18N_TEXT_SOURCES || !node || node.nodeType !== 3) return;
  const text = String(source);
  I18N_TEXT_SOURCES.set(node, I18N_RENDERED_VALUES.get(text) || text);
}
function localizeRuntimeNode(node) {
  if (!node || node.nodeType !== 3) return;
  const parent = node.parentElement;
  if (!parent || parent.closest('script,style,[data-i18n],[data-i18n-raw]')) return;
  let source = I18N_TEXT_SOURCES && I18N_TEXT_SOURCES.get(node);
  if (source === undefined) {
    source = node.nodeValue;
    rememberRuntimeText(node, source);
    source = I18N_TEXT_SOURCES ? I18N_TEXT_SOURCES.get(node) : source;
  }
  const localized = source && typeof source === 'object'
    ? localizeRenderedSource(source)
    : translateRuntime(source);
  if (localized !== node.nodeValue) node.nodeValue = localized;
}

function setLocalizedText(element, value) {
  if (!element) return;
  const source = value === undefined || value === null ? '' : String(value);
  element.textContent = source;
  const node = element.firstChild;
  if (node && node.nodeType === 3) {
    rememberRuntimeText(node, source);
    localizeRuntimeNode(node);
  }
}

function localizeRuntimeAttributes(root) {
  if (!I18N_ATTRIBUTE_SOURCES || !root || !root.querySelectorAll) return;
  const elements = [];
  if (root.nodeType === 1) elements.push(root);
  elements.push(...root.querySelectorAll('*'));
  const attributes = ['title','placeholder','aria-label','alt'];
  elements.forEach(element => {
    let sources = I18N_ATTRIBUTE_SOURCES.get(element);
    attributes.forEach(attribute => {
      const current = element.getAttribute && element.getAttribute(attribute);
      if (!current) return;
      let source = sources && sources.get(attribute);
      if (!source) {
        source = I18N_RENDERED_VALUES.get(String(current));
        if (!source) return;
        if (!sources) { sources = new Map(); I18N_ATTRIBUTE_SOURCES.set(element, sources); }
        sources.set(attribute, source);
      }
      const localized = source && typeof source === 'object' ? localizeRenderedSource(source) : current;
      if (localized !== current) element.setAttribute(attribute, localized);
    });
  });
}

async function loadLocale(lang) {
  lang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'zh-CN';
  if (LOCALES[lang]) return { lang, locale:LOCALES[lang] };
  try {
    const resp = await fetch('locales/' + lang + '.json');
    if (!resp.ok) throw new Error('locale not found');
    const data = await resp.json();
    LOCALES[lang] = data;
    return { lang, locale:data };
  } catch (e) {
    if (lang !== 'zh-CN') return loadLocale('zh-CN');
    return { lang:'zh-CN', locale:{} };
  }
}

function updateGameCatalog() {
  if (typeof GAMES !== 'undefined') Object.keys(GAMES).forEach(id => {
    const g = GAMES[id];
    if (g.nameKey) g.name = t(g.nameKey);
    if (g.descKey) g.desc = t(g.descKey);
  });
  if (typeof RULES !== 'undefined') Object.keys(GAMES || {}).forEach(id => {
    const keys = RULES[id + 'Keys'];
    if (Array.isArray(keys)) RULES[id] = keys.map(k => t(k));
  });
}

function t(key, ...args) {
  let text = currentLocale[key];
  if (text === undefined || text === null) {
    if (currentLang !== 'en-US' && LOCALES['en-US'] && LOCALES['en-US'][key] !== undefined) {
      text = LOCALES['en-US'][key];
    } else {
      return key;
    }
  }
  if (args.length > 0) {
    let i = 0;
    text = text.replace(/%[sd]/g, () => {
      const arg = args[i++];
      return arg !== undefined ? String(arg) : '';
    });
  }
  rememberRenderedTranslation(text, key, args);
  return text;
}

/* Count-bearing UI selects grammar at the i18n boundary, never in a route,
 * profile card, or leaderboard renderer. The fallback keeps the three shipped
 * locales legible even if a legacy runtime does not provide Intl.PluralRules. */
const I18N_PLURAL_RULES = typeof Map !== 'undefined' ? new Map() : null;
function normalizedPluralCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.max(0, Math.trunc(numeric)) : 0;
}
function pluralCategory(count) {
  const normalized = normalizedPluralCount(count);
  try {
    let rules = I18N_PLURAL_RULES && I18N_PLURAL_RULES.get(currentLang);
    if (!rules && typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
      rules = new Intl.PluralRules(currentLang);
      if (I18N_PLURAL_RULES) I18N_PLURAL_RULES.set(currentLang, rules);
    }
    if (rules) return rules.select(normalized);
  } catch (_error) {}
  if (currentLang === 'uk-UA') {
    const mod10 = normalized % 10, mod100 = normalized % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
    return 'many';
  }
  return normalized === 1 ? 'one' : 'other';
}
function tPlural(key, count, ...args) {
  const normalized = normalizedPluralCount(count);
  const category = pluralCategory(normalized);
  for (const candidate of [key + '_' + category, key + '_other', key]) {
    const translated = t(candidate, normalized, ...args);
    if (translated !== candidate) {
      rememberRenderedSource(translated, { kind:'plural', key, args:[normalized, ...args] });
      return translated;
    }
  }
  return key;
}
function formatGamesCount(count) { return tPlural('games_count', count); }
function formatWinsCount(count) { return tPlural('wins_count', count); }
function formatRemainingWins(count) { return tPlural('remaining_wins', count); }
function formatGameRecord(played, wins, rate) {
  const rendered = t('profile_game_record', formatGamesCount(played), formatWinsCount(wins), rate === undefined || rate === null ? '—' : rate);
  rememberRenderedSource(rendered, { kind:'game_record', args:[played, wins, rate] });
  return rendered;
}
function formatMasteryJourneyGoal(gameName, remaining, title) {
  const rendered = t('profile_journey_mastery_goal', gameName, formatRemainingWins(remaining), title);
  rememberRenderedSource(rendered, { kind:'mastery_journey_goal', args:[gameName, remaining, title] });
  return rendered;
}
function formatMasteryNextHint(remaining, threshold) {
  const rendered = t('mastery_next_hint', formatRemainingWins(remaining), formatWinsCount(threshold));
  rememberRenderedSource(rendered, { kind:'mastery_next_hint', args:[remaining, threshold] });
  return rendered;
}

function i18nElements(root, selector) {
  if (!root) return [];
  const elements = [];
  if (root.nodeType === 1 && root.matches && root.matches(selector)) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll(selector));
  return elements;
}

function applyI18n(root) {
  root = root || document;
  i18nElements(root, '[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  i18nElements(root, '[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  i18nElements(root, '[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  i18nElements(root, '[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });
  i18nElements(root, '[data-i18n-alt]').forEach(el => {
    const key = el.getAttribute('data-i18n-alt');
    if (key) el.setAttribute('alt', t(key));
  });
  localizeRuntimeAttributes(root);
  const titleEl = typeof document !== 'undefined' && document.querySelector ? document.querySelector('title[data-i18n]') : null;
  if (titleEl) titleEl.textContent = t(titleEl.getAttribute('data-i18n'));
  if (currentLang !== 'zh-CN' && typeof document !== 'undefined' && document.createTreeWalker) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(localizeRuntimeNode);
  } else if (currentLang === 'zh-CN' && typeof document !== 'undefined' && document.createTreeWalker) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(localizeRuntimeNode);
  }
}

let i18nObserver = null;
function installI18nObserver(){
  if (i18nObserver || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  i18nObserver = new MutationObserver(records => {
    const roots = new Set(), nodes = [];
    records.forEach(record => {
      if (record.type === 'characterData') nodes.push(record.target);
      else if (record.type === 'attributes') roots.add(record.target);
      else (record.addedNodes || []).forEach(node => {
        if (node.nodeType === 3) nodes.push(node);
        else if (node.nodeType === 1) roots.add(node);
      });
    });
    roots.forEach(applyI18n);
    nodes.forEach(localizeRuntimeNode);
  });
  i18nObserver.observe(document.body,{
    subtree:true,
    childList:true,
    characterData:true,
    attributes:true,
    attributeFilter:['data-i18n','data-i18n-title','data-i18n-placeholder','data-i18n-aria-label','data-i18n-alt'],
  });
}

const LANG_FLAGS = { 'zh-CN': '🇨🇳', 'en-US': '🇺🇸', 'uk-UA': '🇺🇦' };
const LANG_NAMES = { 'zh-CN': '中文', 'en-US': 'English', 'uk-UA': 'Українська' };

function langFlag(lang) { return LANG_FLAGS[lang] || ''; }

async function setLanguage(lang) {
  const requestedLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'zh-CN';
  const requestSequence = ++languageRequestSequence;
  const loaded = await loadLocale(requestedLang);
  if (requestSequence !== languageRequestSequence) return false;
  currentLang = loaded.lang;
  currentLocale = loaded.locale;
  updateGameCatalog();
  try { localStorage.setItem('mg_lang', currentLang); } catch {}
  if (typeof account !== 'undefined' && account) {
    account.lang = currentLang;
    if (typeof saveAccount === 'function') saveAccount();
  }
  if (document.documentElement) {
    document.documentElement.setAttribute('data-lang', currentLang);
    document.documentElement.setAttribute('lang', currentLang);
  }
  applyI18n();
  // Formatted runtime values (for example Playline's audience label) must be
  // recomputed from stable IDs after the committed locale changes.  Static
  // applyI18n cannot safely translate an already formatted parameter.
  try { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event('languagechange')); } catch {}
  // Static icon labels and early-rendered dynamic rails may be created before
  // the async locale request resolves. Re-render them from stable keys once
  // the committed locale is available so a temporary key never becomes UI.
  if (typeof initStaticPlatformIcons === 'function') initStaticPlatformIcons();
  if (typeof currentGameId !== 'undefined' && currentGameId && typeof GAMES !== 'undefined' && GAMES[currentGameId] && typeof $ === 'function') {
    const gameTitle = $('game-title');
    if (gameTitle) gameTitle.textContent = GAMES[currentGameId].icon + ' ' + GAMES[currentGameId].name;
  }
  renderHub();
  renderLeaderboard();
  renderAccounts();
  renderMe();
  renderLobby();
  if (typeof renderGhostHome === 'function') renderGhostHome();
  if (typeof renderGhostProfile === 'function') renderGhostProfile();
  if (typeof renderSocialRail === 'function') renderSocialRail();
  if (typeof setChatView === 'function' && typeof ghostAppRoute !== 'undefined' && ghostAppRoute === 'chat') setChatView(typeof ghostChatView !== 'undefined' ? ghostChatView : 'players', { silentHash:true });
  if (online.room) renderRoomPanel();
  if (currentGame && typeof currentGame.onLanguageChange === 'function') currentGame.onLanguageChange(currentLang);
  if (typeof renderGameStage === 'function') renderGameStage();
  if (online.connected && account && account.uid) {
    online.send({ type:'profile', payload: { uid: account.uid, name: account.name, avatar: account.avatar, lang:currentLang } });
  }
  return true;
}

function initI18n() {
  let lang = 'zh-CN';
  try { lang = localStorage.getItem('mg_lang') || 'zh-CN'; } catch {}
  if (!SUPPORTED_LANGUAGES.includes(lang)) lang = 'zh-CN';
  return setLanguage(lang).then(() => { installI18nObserver(); });
}

'use strict';
