import { scaleQuantize } from 'd3-scale'
import { minBy, uniq } from 'lodash'
import { DateTime } from 'luxon'
import { getMoonIllumination, getMoonTimes } from 'suncalc'
import { IMoonDay, IMoonPhase } from './index'

const getNewMoonDate = (params: {
  startDate: DateTime
  shouldCalcPrevNewMoon?: boolean
}): DateTime => {
  const { startDate } = params
  const moonIlluminationMoments = []
  for (let i = 0; i < 60 * 24 * 30; i++) {
    const calculationMoment: DateTime = params.shouldCalcPrevNewMoon
      ? startDate.minus({ minutes: i })
      : startDate.plus({ minutes: i })

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

const getMoonRisesBetween = (params: {
  prevNewMoon: DateTime
  nextNewMoon: DateTime
  coordinates: { lat: number; lng: number }
}): DateTime[] => {
  const {
    prevNewMoon,
    nextNewMoon,
    coordinates: { lat, lng },
  } = params
  const moonRises = []

  moonRises.push(prevNewMoon.toISO()) // we use exact new moon moment as moon moth boundary

  const hoursBetweenNewMoons = Math.floor(
    nextNewMoon.diff(prevNewMoon, 'hours').hours
  )
  for (let i = 0; i <= hoursBetweenNewMoons; i++) {
    const moonTimesAtSomeMomentOfMonth = getMoonTimes(
      prevNewMoon.plus({ hours: i }).toJSDate(),
      lat,
      lng,
      true
    )
    if (!moonTimesAtSomeMomentOfMonth.rise) {
      continue
    }

    const moonRiseMoment = DateTime.fromJSDate(
      moonTimesAtSomeMomentOfMonth.rise
    )
    if (moonRiseMoment >= prevNewMoon && moonRiseMoment <= nextNewMoon) {
      moonRises.push(moonRiseMoment.toISO())
    }
  }

  moonRises.push(nextNewMoon.toISO()) // we use exact new moon moment as moon moth boundary

  const uniqueMoonRises = uniq(moonRises)
  return uniqueMoonRises.map(ISODate => DateTime.fromISO(ISODate))
}

const convertMoonRisesToDays = (moonRises: DateTime[]): IMoonDay[] => {
  const moonDays = []
  for (let i = 0; i < moonRises.length - 1; i++) {
    moonDays.push({
      dayEnd: moonRises[i + 1],
      dayNumber: i + 1,
      dayStart: moonRises[i],
    })
  }
  return moonDays
}

export const calculateMoonDayFor = (
  date: DateTime,
  coordinates: { lat: number; lng: number }
): IMoonDay | undefined => {
  const prevNewMoon = getNewMoonDate({
    shouldCalcPrevNewMoon: true,
    startDate: date,
  })
  const nextNewMoon = getNewMoonDate({ startDate: date })

  const moonRisesAtSoughtMonth = getMoonRisesBetween({
    coordinates,
    nextNewMoon,
    prevNewMoon,
  })

  const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth)

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
    .domain([1, 29]) // FIXME get number of days from current month

  return scale(dayNumber)
}
