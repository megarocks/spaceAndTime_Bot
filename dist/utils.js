"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const plural_ru_1 = require("plural-ru");
const moonCalc_1 = require("./moonCalc");
function createMoonMessage({ moonDay, timeZone, calculationDate }) {
    const { dayNumber, dayStart, dayEnd } = moonDay;
    const { symbol, label } = moonCalc_1.getMoonPhaseEmojiAndLabelByDate(calculationDate);
    return `🌝 Луна:
${symbol} день: *${dayNumber}* - ${label}
🎭 тип дня: _${getMoonDayType(moonDay.dayNumber)}_
🚦 начинания: _${getBeginningsRecommendation(moonDay.dayNumber)}_  
⏳ начало: _${dayStart
        .setZone(timeZone)
        .setLocale('ru')
        .toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_
⌛️ завершение: _${dayEnd
        .setZone(timeZone)
        .setLocale('ru')
        .toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}_  
`;
}
exports.createMoonMessage = createMoonMessage;
function createSolarMessage({ sunRiseToday, sunSetToday, dayDurationDiff, timeZone, }) {
    const dayLength = sunSetToday.diff(sunRiseToday);
    return `☀️ Световой день:
🌅 ${sunRiseToday.setZone(timeZone).toLocaleString(luxon_1.DateTime.TIME_24_SIMPLE)} - ${sunSetToday.setZone(timeZone).toLocaleString(luxon_1.DateTime.TIME_24_SIMPLE)} (${getDayDurationMsg(dayLength)})
⏱ ${getDayDurationDiffMsg(dayDurationDiff)}\n`;
}
exports.createSolarMessage = createSolarMessage;
function createCalendarMessage(googleCalendarEvent) {
    const { summary = '', description = '' } = googleCalendarEvent;
    let message = '';
    if (summary) {
        message += summary;
    }
    if (description) {
        message += `\n${description}`;
    }
    return message;
}
exports.createCalendarMessage = createCalendarMessage;
function createStartMessage() {
    return `Привет
Буду оповещать тебя о начале нового лунного дня и месяца, фазах луны, и других натуральных циклах нашей планеты
Доступные команды:
/location - задать своё местоположение
/day - получить информацию о текущем дне`;
}
exports.createStartMessage = createStartMessage;
function createHelpMessage() {
    return ('Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
        'Буду оповещать тебя о начале нового лунного дня, и месяца, фазах луны, и других натуральных циклах нашей планеты\n' +
        'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps');
}
exports.createHelpMessage = createHelpMessage;
function getMoonDayType(moonDayNumber) {
    if ([1, 6, 11, 16, 21, 26].indexOf(moonDayNumber) > -1)
        return 'удовлетворение 👌';
    if ([2, 7, 12, 17, 22, 27].indexOf(moonDayNumber) > -1)
        return 'мудрец 🤝';
    if ([3, 8, 13, 18, 23, 28].indexOf(moonDayNumber) > -1)
        return 'победитель ✊';
    if ([4, 9, 14, 19, 24, 29].indexOf(moonDayNumber) > -1)
        return 'пустые руки 🤲';
    if ([5, 10, 15, 20, 25, 30].indexOf(moonDayNumber) > -1)
        return 'полнота 🙏';
    return 'неизвестно';
}
function getBeginningsRecommendation(moonDayNumber) {
    if ([1, 6, 11, 16, 21, 26].indexOf(moonDayNumber) > -1)
        return 'норма ⏯️';
    if ([2, 7, 12, 17, 22, 27].indexOf(moonDayNumber) > -1)
        return 'норма ⏯️';
    if ([3, 8, 13, 18, 23, 28].indexOf(moonDayNumber) > -1)
        return 'хорошо ▶️';
    if ([4, 9, 14, 19, 24, 29].indexOf(moonDayNumber) > -1)
        return 'такое ⏸';
    if ([5, 10, 15, 20, 25, 30].indexOf(moonDayNumber) > -1)
        return 'хорошо ▶️';
    return 'неизвестно';
}
function getDayDurationDifference(sunTimesToday, sunTimesYtd) {
    const sunRiseToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunrise);
    const sunSetToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunset);
    const dayLengthToday = sunSetToday.diff(sunRiseToday);
    const sunRiseYtd = luxon_1.DateTime.fromJSDate(sunTimesYtd.sunrise);
    const sunSetYtd = luxon_1.DateTime.fromJSDate(sunTimesYtd.sunset);
    const dayLengthYtd = sunSetYtd.diff(sunRiseYtd);
    return dayLengthToday.minus(dayLengthYtd);
}
exports.getDayDurationDifference = getDayDurationDifference;
function getDayDurationDiffMsg(duration) {
    const directionWord = duration.as('milliseconds') > 0 ? 'больше' : 'меньше';
    let { minutes, seconds } = duration.shiftTo('minutes', 'seconds');
    minutes = Math.ceil(Math.abs(minutes));
    seconds = Math.ceil(Math.abs(seconds));
    return `день на ${minutes} ${plural_ru_1.noun(minutes, 'минута', 'минуты', 'минут')} ${seconds} ${plural_ru_1.noun(seconds, 'секунда', 'секунды', 'секунд')} ${directionWord} чем вчера`;
}
function getDayDurationMsg(duration) {
    let { hours, minutes } = duration.shiftTo('hours', 'minutes');
    hours = Math.ceil(Math.abs(hours));
    minutes = Math.ceil(Math.abs(minutes));
    return `${hours} ${plural_ru_1.noun(minutes, 'час', 'часа', 'часов')} ${minutes} ${plural_ru_1.noun(minutes, 'минута', 'минуты', 'минут')}`;
}
