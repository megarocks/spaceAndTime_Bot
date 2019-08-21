import { DateTime, Duration } from 'luxon'
import { calendar_v3 } from 'googleapis'
import Schema$Event = calendar_v3.Schema$Event
import { noun } from 'plural-ru'

import { getMoonPhaseEmojiAndLabelByDate } from './moonCalc'
import { IMoonDay } from './interfaces'
import { GetTimesResult } from 'suncalc'

export function createMoonMessage({ moonDay, timeZone, calculationDate }: { moonDay: IMoonDay; timeZone: string, calculationDate: DateTime }): string {
  const { dayNumber, dayStart, dayEnd } = moonDay

  const { symbol, label } = getMoonPhaseEmojiAndLabelByDate(calculationDate)

  return `🌝 Луна:
${symbol} день: *${dayNumber}* - ${label}
🎭 тип дня: _${getMoonDayType(moonDay.dayNumber)}_
🚦 начинания: _${getBeginningsRecommendation(moonDay.dayNumber)}_  
⏳ начало: _${dayStart
    .setZone(timeZone)
    .setLocale('ru')
    .toLocaleString(DateTime.DATETIME_SHORT)}_
⌛️ завершение: _${dayEnd
    .setZone(timeZone)
    .setLocale('ru')
    .toLocaleString(DateTime.DATETIME_SHORT)}_  
`
}

export function createSolarMessage({
  sunRiseToday,
  sunSetToday,
  dayDurationDiff,
  timeZone,
}: {
  sunRiseToday: DateTime
  sunSetToday: DateTime
  dayDurationDiff: Duration,
  timeZone: string
}): string {
  const dayLength = sunSetToday.diff(sunRiseToday)
  return `☀️ Световой день:
🌅 ${sunRiseToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)} - ${sunSetToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)} (${getDayDurationMsg(dayLength)})
⏱ ${getDayDurationDiffMsg(dayDurationDiff)}\n`
}

export function createCalendarMessage(googleCalendarEvent: Schema$Event): string {
  const { summary = '', description = '' } = googleCalendarEvent
  let message = ''
  if (summary) {
    message += summary
  }
  if (description) {
    message += `\n${description}`
  }
  return message
}

export function createStartMessage(): string {
  return `Привет
Буду оповещать тебя о начале нового лунного дня и месяца, фазах луны, и других натуральных циклах нашей планеты
Доступные команды:
/location - задать своё местоположение
/day - получить информацию о текущем дне`
}

export function createHelpMessage(): string {
  return (
    'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
    'Буду оповещать тебя о начале нового лунного дня, и месяца, фазах луны, и других натуральных циклах нашей планеты\n' +
    'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps'
  )
}

function getMoonDayType(moonDayNumber: number): string {
  if ([1, 6, 11, 16, 21, 26].indexOf(moonDayNumber) > -1) return 'удовлетворение 👌'
  if ([2, 7, 12, 17, 22, 27].indexOf(moonDayNumber) > -1) return 'мудрец 🤝'
  if ([3, 8, 13, 18, 23, 28].indexOf(moonDayNumber) > -1) return 'победитель ✊'
  if ([4, 9, 14, 19, 24, 29].indexOf(moonDayNumber) > -1) return 'пустые руки 🤲'
  if ([5, 10, 15, 20, 25, 30].indexOf(moonDayNumber) > -1) return 'полнота 🙏'
  return 'неизвестно'
}

function getBeginningsRecommendation(moonDayNumber: number): string {
  if ([1, 6, 11, 16, 21, 26].indexOf(moonDayNumber) > -1) return 'норма ⏯️'
  if ([2, 7, 12, 17, 22, 27].indexOf(moonDayNumber) > -1) return 'норма ⏯️'
  if ([3, 8, 13, 18, 23, 28].indexOf(moonDayNumber) > -1) return 'хорошо ▶️'
  if ([4, 9, 14, 19, 24, 29].indexOf(moonDayNumber) > -1) return 'такое ⏸'
  if ([5, 10, 15, 20, 25, 30].indexOf(moonDayNumber) > -1) return 'хорошо ▶️'
  return 'неизвестно'
}

export function getDayDurationDifference(sunTimesToday: GetTimesResult, sunTimesYtd: GetTimesResult): Duration {
  const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
  const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)
  const dayLengthToday = sunSetToday.diff(sunRiseToday)

  const sunRiseYtd = DateTime.fromJSDate(sunTimesYtd.sunrise)
  const sunSetYtd = DateTime.fromJSDate(sunTimesYtd.sunset)
  const dayLengthYtd = sunSetYtd.diff(sunRiseYtd)

  return dayLengthToday.minus(dayLengthYtd)
}

function getDayDurationDiffMsg(duration: Duration): string {
  const directionWord = duration.as('milliseconds') > 0 ? 'больше' : 'меньше'
  let { minutes, seconds } = duration.shiftTo('minutes', 'seconds')
  minutes = Math.ceil(Math.abs(minutes))
  seconds = Math.ceil(Math.abs(seconds))
  return `день на ${minutes} ${noun(minutes, 'минута', 'минуты', 'минут')} ${seconds} ${noun(seconds, 'секунда', 'секунды', 'секунд')} ${directionWord} чем вчера`
}

function getDayDurationMsg(duration: Duration): string {
  let { hours, minutes } = duration.shiftTo('hours', 'minutes')
  hours = Math.ceil(Math.abs(hours))
  minutes = Math.ceil(Math.abs(minutes))
  return `${hours} ${noun(minutes, 'час', 'часа', 'часов')} ${minutes} ${noun(minutes, 'минута', 'минуты', 'минут')}`
}
