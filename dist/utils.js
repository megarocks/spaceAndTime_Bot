"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
function createReportMessage({ moonDay, timeZone }) {
    if (!moonDay)
        return 'Не могу рассчитать лунный день. Странная астрологическая обстановка. Учти это';
    const { dayNumber, dayStart, dayEnd } = moonDay;
    let leftHours = Math.floor(dayEnd.setZone(timeZone).diff(luxon_1.DateTime.utc().setZone(timeZone), 'hours').hours);
    let leftHoursMessage = leftHours ? `Через ${leftHours} ${getNoun(leftHours, 'час', 'часа', 'часов')}` : 'менее чем через час';
    let reportMessage = `Текущий лунный день: *${dayNumber}*
День начался: _${dayStart.setZone(timeZone).setLocale('ru').toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_
День завершится: _${dayEnd.setZone(timeZone).setLocale('ru').toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_
Начало следующего: _${leftHoursMessage}_
`;
    return reportMessage;
}
exports.createReportMessage = createReportMessage;
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
