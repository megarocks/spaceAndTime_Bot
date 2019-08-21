import { scaleQuantize } from 'd3-scale'
import { minBy, uniq } from 'lodash'
import { DateTime } from 'luxon'
import { getMoonIllumination, getMoonTimes } from 'suncalc'
import { IMoonDay, IMoonPhase } from './interfaces'

export const isBeforeFullMoonAt = (moment: DateTime): boolean => {
  const currentIllumination = getMoonIllumination(moment.toJSDate()).fraction
  const nextMomentIllumination = getMoonIllumination(moment.plus({ minutes: 1 }).toJSDate()).fraction
  return nextMomentIllumination > currentIllumination
}

export const getNewMoonDate = (params: { startDate: DateTime; isTravelingToPast?: boolean; anotherNewMoon?: DateTime }): DateTime => {
  const { startDate, isTravelingToPast } = params

  const isBeforeFullMoon = isBeforeFullMoonAt(startDate)
  const moonIlluminationMoments = []
  for (let i = 0; i < 717 * 60; i++) {
    // up to 717 hours per lunar month
    if (isBeforeFullMoon && !isTravelingToPast && i < 175 * 60) {
      continue
    }
    if (isBeforeFullMoon && isTravelingToPast && i >= 375 * 60) {
      break
    }
    if (!isBeforeFullMoon && !isTravelingToPast && i >= 375 * 60) {
      break
    }
    if (!isBeforeFullMoon && isTravelingToPast && i < 175 * 60) {
      continue
    }

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
  return moonDays.find(d => date >= d.dayStart && date <= d.dayEnd)
}

const phases = [
  { symbol: '🌚', label: 'новая луна' },
  { symbol: '🌒', label: 'молодая луна' },
  { symbol: '🌓', label: 'первая четверть' },
  { symbol: '🌔', label: 'прибывающая луна' },
  { symbol: '🌕', label: 'полная луна' },
  { symbol: '🌖', label: 'убывающая луна' },
  { symbol: '🌗', label: 'последняя четверть' },
  { symbol: '🌘', label: 'бальзамическая луна' },
]

export const getMoonPhaseEmojiAndLabelByDate = (date: DateTime): IMoonPhase => {
  const scale = scaleQuantize<IMoonPhase>()
    .range(phases)
    .domain([0, 1])

  const moonIlluminationPhase = getMoonIllumination(date.toJSDate()).phase
  return scale(moonIlluminationPhase)
}
