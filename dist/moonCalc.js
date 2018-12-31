"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const d3_scale_1 = require("d3-scale");
const lodash_1 = require("lodash");
const luxon_1 = require("luxon");
const suncalc_1 = require("suncalc");
exports.getNewMoonDate = (params) => {
    const { startDate } = params;
    const moonIlluminationMoments = [];
    for (let i = 0; i < 717 * 60; i++) { // up to 717 hours per lunar month
        const calculationMoment = params.isTravelingToPast ? startDate.minus({ minutes: i }) : startDate.plus({ minutes: i });
        if (params.anotherNewMoon) {
            const shouldSkip = Math.abs(params.anotherNewMoon.diff(calculationMoment).as('days')) < 25;
            if (shouldSkip) {
                continue;
            }
        }
        const moonIllumination = suncalc_1.getMoonIllumination(calculationMoment.toJSDate());
        moonIlluminationMoments.push({
            illuminationFraction: moonIllumination.fraction,
            moment: calculationMoment,
        });
    }
    const newMoon = lodash_1.minBy(moonIlluminationMoments, i => i.illuminationFraction);
    if (!newMoon) {
        throw new Error('can`t calculate new moon for: ' + startDate.toISO());
    }
    return newMoon.moment;
};
const getMoonRisesBetween = (params) => {
    const { prevNewMoon, nextNewMoon, coordinates: { lat, lng }, } = params;
    const moonRises = [];
    moonRises.push(prevNewMoon.toISO()); // we use exact new moon moment as moon moth boundary
    const hoursBetweenNewMoons = Math.floor(nextNewMoon.diff(prevNewMoon, 'hours').hours);
    for (let i = 0; i <= hoursBetweenNewMoons; i++) {
        const moonTimesAtSomeMomentOfMonth = suncalc_1.getMoonTimes(prevNewMoon.plus({ hours: i }).toJSDate(), lat, lng, true);
        if (!moonTimesAtSomeMomentOfMonth.rise) {
            continue;
        }
        const moonRiseMoment = luxon_1.DateTime.fromJSDate(moonTimesAtSomeMomentOfMonth.rise);
        if (moonRiseMoment >= prevNewMoon && moonRiseMoment <= nextNewMoon) {
            moonRises.push(moonRiseMoment.toISO());
        }
    }
    moonRises.push(nextNewMoon.toISO()); // we use exact new moon moment as moon moth boundary
    const uniqueMoonRises = lodash_1.uniq(moonRises);
    return uniqueMoonRises.map(ISODate => luxon_1.DateTime.fromISO(ISODate).toUTC());
};
exports.getMoonDaysBetweenNewMoons = (params) => {
    const { prevNewMoon, nextNewMoon, coordinates } = params;
    const moonRises = getMoonRisesBetween({
        coordinates,
        nextNewMoon,
        prevNewMoon,
    });
    const moonDays = [];
    for (let i = 0; i < moonRises.length - 1; i++) {
        moonDays.push({
            dayStart: moonRises[i],
            dayEnd: moonRises[i + 1],
            dayNumber: i + 1,
        });
    }
    return moonDays;
};
exports.calculateMoonDayFor = (date, coordinates) => {
    const prevNewMoon = exports.getNewMoonDate({
        isTravelingToPast: true,
        startDate: date,
    });
    const nextNewMoon = exports.getNewMoonDate({ startDate: date, anotherNewMoon: prevNewMoon });
    const moonDays = exports.getMoonDaysBetweenNewMoons({
        coordinates,
        nextNewMoon,
        prevNewMoon,
    });
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
    return moonDays.find(d => date >= d.dayStart && date <= d.dayEnd);
};
exports.getMoonPhaseEmojiAndLabel = (dayNumber) => {
    const scale = d3_scale_1.scaleQuantize()
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
        .domain([1, 30]); // FIXME get number of days from current month
    return scale(dayNumber);
};
