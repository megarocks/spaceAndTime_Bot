"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const d3_scale_1 = require("d3-scale");
const lodash_1 = require("lodash");
const luxon_1 = require("luxon");
const suncalc_1 = require("suncalc");
const getNewMoonDate = (params) => {
    const { startDate } = params;
    const moonIlluminationMoments = [];
    for (let i = 0; i < 60 * 24 * 30; i++) {
        const calculationMoment = params.shouldCalcPrevNewMoon
            ? startDate.minus({ minutes: i })
            : startDate.plus({ minutes: i });
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
    return uniqueMoonRises.map(ISODate => luxon_1.DateTime.fromISO(ISODate));
};
const convertMoonRisesToDays = (moonRises) => {
    const moonDays = [];
    for (let i = 0; i < moonRises.length - 1; i++) {
        moonDays.push({
            dayEnd: moonRises[i + 1],
            dayNumber: i + 1,
            dayStart: moonRises[i],
        });
    }
    return moonDays;
};
exports.calculateMoonDayFor = (date, coordinates) => {
    const prevNewMoon = getNewMoonDate({
        shouldCalcPrevNewMoon: true,
        startDate: date,
    });
    const nextNewMoon = getNewMoonDate({ startDate: date });
    const moonRisesAtSoughtMonth = getMoonRisesBetween({
        coordinates,
        nextNewMoon,
        prevNewMoon,
    });
    const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth);
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
        .domain([1, 29]); // FIXME get number of days from current month
    return scale(dayNumber);
};
