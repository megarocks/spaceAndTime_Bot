import { DateTime, Duration } from 'luxon'
import SunCalc, { GetMoonIlluminationResult } from 'suncalc'

import { IMoonDay } from './interfaces'
import { calculateMoonDayFor } from './moonCalc'

function* timeMachine({
  start,
  end,
  stepUnit = 'days',
  step = 1,
  lat = 52.3679843,
  lng = 4.9035614,
}: {
  start: DateTime
  end?: DateTime
  stepUnit: string
  step: number
  lat: number
  lng: number
}): IterableIterator<{ dateTime: DateTime; dayLength: Duration; nightLength: Duration; moonDay?: IMoonDay; moonIllumination: GetMoonIlluminationResult }> {
  if (step === 0) {
    throw new Error('Step may not be 0')
  }
  if (end && step > 0 && start > end) {
    throw new Error('You can`t travel to future when end of the trip in the past')
  }
  if (end && step < 0 && end > start) {
    throw new Error('You can`t travel to past when end of the trip in the future')
  }

  let counter = 0

  const isTravelFinished = () => {
    if (!end) {
      return false
    }

    const isMovingToFuture = step > 0
    if (isMovingToFuture) {
      return start.plus({ [stepUnit]: counter }) > end
    } else {
      return start.plus({ [stepUnit]: counter }) < end
    }
  }

  while (!isTravelFinished()) {
    const currentDate = start.plus({ [stepUnit]: counter })
    const sunTimesToday = SunCalc.getTimes(currentDate.toJSDate(), lat, lng)
    const sunTimesYesterday = SunCalc.getTimes(currentDate.minus({ days: 1 }).toJSDate(), lat, lng)

    const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
    const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)

    const sunSetYesterday = DateTime.fromJSDate(sunTimesYesterday.sunset)

    const dayLength = sunSetToday.diff(sunRiseToday)
    const nightLength = sunRiseToday.diff(sunSetYesterday)

    const moonIllumination = SunCalc.getMoonIllumination(currentDate.toJSDate())

    const moonDay = calculateMoonDayFor(currentDate, { lat, lng })
    yield {
      dateTime: currentDate,
      dayLength,
      moonDay,
      moonIllumination,
      nightLength,
    }
    counter += step
  }
}

export default timeMachine
