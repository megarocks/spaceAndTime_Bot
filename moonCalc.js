const moment = require('moment');
const SunCalc = require('suncalc');
const lodash = require('lodash');

const getNewMoonDate = (startDate, coordinates, isPrevious) => {
  const calculationDate = moment(startDate);
  const solarDays = [];
  for (let i = 0; i < 60 * 24 * 30; i++) {
    const moonIllumination = SunCalc.getMoonIllumination(calculationDate);
    solarDays.push({
      date: calculationDate.format(),
      illuminationFraction: moonIllumination.fraction,
    });
    isPrevious ? calculationDate.subtract(1, "m") : calculationDate.add(1, "m")
  }
  const solarDayWithNewMoon = lodash.minBy(solarDays, (i) => i.illuminationFraction);
  const moonTimesAtNewMoonDay = SunCalc.getMoonTimes(moment(solarDayWithNewMoon.date), coordinates.lat, coordinates.lon);
  return {...solarDayWithNewMoon, rise: moment(moonTimesAtNewMoonDay.rise).format(), set: moment(moonTimesAtNewMoonDay.set).format()}
};

const getMoonRisesBetween = (prevNewMoon, nextNewMoon, coordinates) => {
  const moonRises = [];
  let moonMonthStart = moment(prevNewMoon.date);
  let moonMonthEnd = moment(nextNewMoon.date);
  moonRises.push(moonMonthStart.format());
  let calculationTime = moment(moonMonthStart);
  do {
    calculationTime.add(1, 'h');
    const moonTimes = SunCalc.getMoonTimes(calculationTime, coordinates.lat, coordinates.lon);
    if (!moonTimes.rise) continue;

    let moonRiseMoment = moment(moonTimes.rise);
    if (moonRiseMoment.isBetween(moonMonthStart, moonMonthEnd)) {
      moonRises.push(moonRiseMoment.format())
    }
  } while (calculationTime.isBefore(moonMonthEnd));
  moonRises.push(moonMonthEnd.format());
  return lodash.uniq(moonRises);
};

const convertMoonRisesToDays = moonRises => {
  const moonDays = [];
  for (let i=0; i < moonRises.length - 1; i++) {
    moonDays.push({
      dayNumber: i + 1,
      dayStart: moonRises[i],
      dayEnd: moonRises[i+1]
    })
  }
  return moonDays
};

const calculateMoonDayFor = (date, coordinates) => {
  const prevNewMoon = getNewMoonDate(date, coordinates, true);
  const nextNewMoon = getNewMoonDate(date, coordinates);
  const moonRisesAtSoughtMonth = getMoonRisesBetween(prevNewMoon, nextNewMoon, coordinates);
  const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth);
  const soughtMoonDay = moonDays.find(d => date.isBetween(d.dayStart, d.dayEnd));
  return soughtMoonDay
};

module.exports = {
  calculateMoonDayFor
}