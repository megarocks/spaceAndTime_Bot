import { DateTime } from 'luxon'
import { calendar_v3 } from 'googleapis'
import Schema$Event = calendar_v3.Schema$Event

import { getMoonPhaseEmojiAndLabel } from './moonCalc'
import { IMoonDay } from './interfaces'

export function createMoonMessage({ moonDay, timeZone }: { moonDay: IMoonDay; timeZone: string }): string {
  const { dayNumber, dayStart, dayEnd } = moonDay

  const { symbol, label } = getMoonPhaseEmojiAndLabel(dayNumber)

  return `🌝 Луна:
${symbol} день: *${dayNumber}* - ${label}
🔁 начало: _${dayStart
    .setZone(timeZone)
    .setLocale('ru')
    .toLocaleString(DateTime.DATETIME_SHORT)}_
🔁 завершение: _${dayEnd
    .setZone(timeZone)
    .setLocale('ru')
    .toLocaleString(DateTime.DATETIME_SHORT)}_
`
}

export function createSolarMessage({
  sunRiseToday,
  sunSetToday,
  dayPercent,
  nightPercent,
  timeZone,
}: {
  sunRiseToday: DateTime
  sunSetToday: DateTime
  dayPercent: number
  nightPercent: number
  timeZone: string
}): string {
  return `☀️ Солнце:
🌅 восход:\t ${sunRiseToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🌇 закат:\t ${sunSetToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🏙️ дня:\t ${dayPercent.toFixed(1)} %
🌃 ночи:\t ${nightPercent.toFixed(1)} %\n`
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

export function getPercentRelation(values: number[]): number[] {
  const hundredPercent = values.reduce((acc, val) => acc + val, 0)
  return values.map(value => (value * 100) / hundredPercent)
}
