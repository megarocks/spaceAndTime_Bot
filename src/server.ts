// import Koa from 'koa'
// import route from 'koa-route'

import { DateTime } from 'luxon'
import SunCalc from 'suncalc'

function* generateChartData({
  start,
  end,
  stepUnit = 'days',
  step = 1,
  lat = 52.3679843,
  lng = 4.9035614,
}: {
  start: DateTime
  end: DateTime
  stepUnit: string
  step: number
  lat: number
  lng: number
}) {
  let counter = 0

  while (start.plus({ [stepUnit]: counter }) <= end) {
    const currentDate = start.plus({ [stepUnit]: counter })
    const sunTimesToday = SunCalc.getTimes(currentDate.toJSDate(), lat, lng)
    const sunTimesYesterday = SunCalc.getTimes(currentDate.minus({ days: 1 }).toJSDate(), lat, lng)

    const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
    const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)

    const sunSetYesterday = DateTime.fromJSDate(sunTimesYesterday.sunset)

    const dayLength = sunSetToday.diff(sunRiseToday)
    const nightLength = sunRiseToday.diff(sunSetYesterday)

    const moonIllumination = SunCalc.getMoonIllumination(currentDate.toJSDate())
    yield {
      dateTime: currentDate,
      dayLength,
      moonIllumination,
      nightLength,
    }
    counter++
  }
}

const dates = [...generateChartData({ start: DateTime.utc(2018, 12, 27), end: DateTime.utc(2018, 12, 31), stepUnit: 'days', step: 1, lat: 52.3, lng: 4.9 })]

console.log(dates.map(d => ({ ...d, dateTime: d.dateTime.toISO(),  })))

// const app = new Koa()
//
// app.use(route.get('/data', async ctx => {
//
// }))
