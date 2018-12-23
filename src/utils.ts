import {DateTime} from 'luxon';
import {scaleQuantize} from 'd3-scale'

export interface MoonDay {
  dayNumber: number,
  dayStart: DateTime,
  dayEnd: DateTime
}

export interface Chat {
  chatId: number,
  location: {
    type: string,
    coordinates: [number, number]
  },
  moonDayNotified?: number,
  solarDateNotified?: Date
}

export interface NotificationResult {
  chatId: number,
  moonDayNotified?: number,
  solarDateNotified?: Date
}

export function createMoonMessage({moonDay, timeZone}: { moonDay: MoonDay, timeZone: string }): string {
  if (!moonDay) return 'Не могу рассчитать лунный день. Странная астрологическая обстановка. Учти это';

  const {dayNumber, dayStart, dayEnd} = moonDay;

  const getMoonPhaseEmojiAndLabel = dayNumber => {
    const scale = scaleQuantize().range([
      {symbol: '🌚', label: 'новолуние'},
      {symbol: '🌒', label: 'первая фаза'},
      {symbol: '🌓', label: 'первая четверть'},
      {symbol: '🌔', label: 'вторая фаза'},
      {symbol: '🌕', label: 'полнолуние'},
      {symbol: '🌖', label: 'третья фаза'},
      {symbol: '🌗', label: 'третья четверть'},
      {symbol: '🌘', label: 'четвёртая фаза'},
    ]).domain([1, 29])

    return scale(dayNumber)
  }

  const {symbol, label} = getMoonPhaseEmojiAndLabel(dayNumber)

  return `🌝 Луна:
${ symbol } день: *${dayNumber}* - ${label}
🔁 начало: _${dayStart.setZone(timeZone).setLocale('ru').toLocaleString(DateTime.DATETIME_SHORT)}_
🔁 завершение: _${dayEnd.setZone(timeZone).setLocale('ru').toLocaleString(DateTime.DATETIME_SHORT)}_
`
}

export function createSolarMessage({sunRiseToday, sunSetToday, dayPercent, nightPercent, timeZone} : {
  sunRiseToday: DateTime,
  sunSetToday: DateTime,
  dayPercent: number,
  nightPercent: number,
  timeZone: string
}): string {

  return `☀️ Солнце:
🌅 восход:\t ${sunRiseToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🌇 закат:\t ${sunSetToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🏙️ дня:\t ${dayPercent.toFixed(1)} %
🌃 ночи:\t ${nightPercent.toFixed(1)} %\n`
}

export function createStartMessage(): string {
  return `Привет
Буду оповещать тебя о начале нового лунного дня и месяца, фазах луны, и других натуральных циклах нашей планеты
Доступные команды:
/location - задать своё местоположение
/day - получить информацию о текущем дне`
}

export function createHelpMessage(): string {
  return 'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
    'Буду оповещать тебя о начале нового лунного дня, и месяца, фазах луны, и других натуральных циклах нашей планеты\n' +
    'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps'
}

export function getNoun(number: number, one: string, two: string, five: string): string {
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

export function getPercentRelation(values: number[]): number[] {
  const hundredPercent = values.reduce((acc, val) => acc + val, 0)
  return values.map(value => value * 100 / hundredPercent)
}