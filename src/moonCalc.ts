import { scaleQuantize } from 'd3-scale'
import { minBy, uniq } from 'lodash'
import { DateTime } from 'luxon'
import { getMoonIllumination, getMoonTimes } from 'suncalc'
import { IMoonDay, IMoonPhase } from './interfaces'

export const getNewMoonDate = (params: { startDate: DateTime; isTravelingToPast?: boolean; anotherNewMoon?: DateTime }): DateTime => {
  const { startDate } = params
  const moonIlluminationMoments = []
  for (let i = 0; i < 717 * 60; i++) {  // up to 717 hours per lunar month
    const calculationMoment = params.isTravelingToPast ? startDate.minus({ minutes: i }) : startDate.plus({ minutes: i })

    if (params.anotherNewMoon) {
      const shouldSkip = Math.abs(params.anotherNewMoon.diff(calculationMoment).as('days')) < 25
      if (shouldSkip) {
        continue
      }
    }

    const moonIllumination = getMoonIllumination(calculationMoment.toJSDate())

    moonIlluminationMoments.push({
      illuminationFraction: moonIllumination.fraction,
      moment: calculationMoment,
    })
  }
  const newMoon = minBy(moonIlluminationMoments, i => i.illuminationFraction)
  if (!newMoon) {
    throw new Error('can`t calculate new moon for: ' + startDate.toISO())
  }

  return newMoon.moment
}

const getMoonRisesBetween = (params: { prevNewMoon: DateTime; nextNewMoon: DateTime; coordinates: { lat: number; lng: number } }): DateTime[] => {
  const {
    prevNewMoon,
    nextNewMoon,
    coordinates: { lat, lng },
  } = params
  const moonRises = []

  moonRises.push(prevNewMoon.toISO()) // we use exact new moon moment as moon moth boundary

  const hoursBetweenNewMoons = Math.floor(nextNewMoon.diff(prevNewMoon, 'hours').hours)
  for (let i = 0; i <= hoursBetweenNewMoons; i++) {
    const moonTimesAtSomeMomentOfMonth = getMoonTimes(prevNewMoon.plus({ hours: i }).toJSDate(), lat, lng, true)

    if (!moonTimesAtSomeMomentOfMonth.rise) {
      continue
    }

    const moonRiseMoment = DateTime.fromJSDate(moonTimesAtSomeMomentOfMonth.rise)
    if (moonRiseMoment >= prevNewMoon && moonRiseMoment <= nextNewMoon) {
      moonRises.push(moonRiseMoment.toISO())
    }
  }

  moonRises.push(nextNewMoon.toISO()) // we use exact new moon moment as moon moth boundary

  const uniqueMoonRises = uniq(moonRises)
  return uniqueMoonRises.map(ISODate => DateTime.fromISO(ISODate).toUTC())
}

export const getMoonDaysBetweenNewMoons = (params: { prevNewMoon: DateTime; nextNewMoon: DateTime; coordinates: { lat: number; lng: number } }): IMoonDay[] => {
  const { prevNewMoon, nextNewMoon, coordinates } = params
  const moonRises = getMoonRisesBetween({
    coordinates,
    nextNewMoon,
    prevNewMoon,
  })

  const moonDays = []
  for (let i = 0; i < moonRises.length - 1; i++) {
    moonDays.push({
      dayStart: moonRises[i],
      dayEnd: moonRises[i + 1],
      dayNumber: i + 1,
    })
  }
  return moonDays
}

export const calculateMoonDayFor = (date: DateTime, coordinates: { lat: number; lng: number }): IMoonDay | undefined => {
  const prevNewMoon = getNewMoonDate({
    isTravelingToPast: true,
    startDate: date,
  })
  const nextNewMoon = getNewMoonDate({ startDate: date, anotherNewMoon: prevNewMoon })

  const moonDays = getMoonDaysBetweenNewMoons({
    coordinates,
    nextNewMoon,
    prevNewMoon,
  })
  // console.log('\n')
  // // console.log(moonDays.map(md => ({ num: md.dayNumber, start: md.dayStart.toISO(), end: md.dayEnd.toISO() })))
  // console.log({
  //   prevNewMoon: prevNewMoon.toISO(),
  //   nextNewMoon: nextNewMoon.toISO(),
  //   calcDate: date.toISO(),
  //   daysInMonth: moonDays.length,
  //   minutesToPrevNewMoon: date.diff(prevNewMoon).as('minutes'),
  //   minutesToNextNewMoon: nextNewMoon.diff(date).as('minutes'),
  //   minutesBetweenMoons: nextNewMoon.diff(prevNewMoon).as('minutes'),
  // })
  // console.log('\n')
  return moonDays.find(d => date >= d.dayStart && date <= d.dayEnd)
}

export const getMoonPhaseEmojiAndLabel = (dayNumber: number): IMoonPhase => {
  const scale = scaleQuantize<IMoonPhase>()
    .range([
      { symbol: '🌚', label: 'новолуние' },
      { symbol: '🌒', label: 'первая фаза' },
      { symbol: '🌓', label: 'первая четверть' },
      { symbol: '🌔', label: 'вторая фаза' },
      { symbol: '🌕', label: 'полнолуние' },
      { symbol: '🌖', label: 'третья фаза' },
      { symbol: '🌗', label: 'третья четверть' },
      { symbol: '🌘', label: 'четвёртая фаза' },
    ])
    .domain([1, 30]) // FIXME get number of days from current month

  return scale(dayNumber)
}
