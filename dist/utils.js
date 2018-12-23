"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const d3_scale_1 = require("d3-scale");
function createMoonMessage({ moonDay, timeZone }) {
    if (!moonDay)
        return 'Не могу рассчитать лунный день. Странная астрологическая обстановка. Учти это';
    const { dayNumber, dayStart, dayEnd } = moonDay;
    const getMoonPhaseEmojiAndLabel = dayNumber => {
        const scale = d3_scale_1.scaleQuantize().range([
            { symbol: '🌚', label: 'новолуние' },
            { symbol: '🌒', label: 'первая фаза' },
            { symbol: '🌓', label: 'первая четверть' },
            { symbol: '🌔', label: 'вторая фаза' },
            { symbol: '🌕', label: 'полнолуние' },
            { symbol: '🌖', label: 'третья фаза' },
            { symbol: '🌗', label: 'третья четверть' },
            { symbol: '🌘', label: 'четвёртая фаза' },
        ]).domain([1, 29]);
        return scale(dayNumber);
    };
    const { symbol, label } = getMoonPhaseEmojiAndLabel(dayNumber);
    return `🌝 Луна:
${symbol} день: *${dayNumber}* - ${label}
🔁 начало: _${dayStart.setZone(timeZone).setLocale('ru').toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_
🔁 завершение: _${dayEnd.setZone(timeZone).setLocale('ru').toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_
`;
}
exports.createMoonMessage = createMoonMessage;
function createStartMessage() {
    return `Привет
Буду оповещать тебя о начале нового лунного дня и месяца, фазах луны, и других натуральных циклах нашей планеты
Доступные команды:
/location - задать своё местоположение
/day - получить информацию о текущем дне`;
}
exports.createStartMessage = createStartMessage;
function createHelpMessage() {
    return 'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
        'Буду оповещать тебя о начале нового лунного дня, и месяца, фазах луны, и других натуральных циклах нашей планеты\n' +
        'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps';
}
exports.createHelpMessage = createHelpMessage;
function getNoun(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) {
        return five;
    }
    n %= 10;
    if (n === 1) {
        return one;
    }
    if (n >= 2 && n <= 4) {
        return two;
    }
    return five;
}
exports.getNoun = getNoun;
function getPercentRelation(values) {
    const hundredPercent = values.reduce((acc, val) => acc + val, 0);
    return values.map(value => value * 100 / hundredPercent);
}
exports.getPercentRelation = getPercentRelation;
