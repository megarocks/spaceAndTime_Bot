"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const suncalc_1 = require("suncalc");
const lodash_1 = require("lodash");
const getNewMoonDate = (params) => {
    const { startDate } = params;
    const moonIlluminationMoments = [];
    for (let i = 0; i < 60 * 24 * 30; i++) {
        let calculationMoment;
        if (params.shouldCalcPrevNewMoon)
            calculationMoment = startDate.minus({ minutes: i });
        else
            calculationMoment = startDate.plus({ minutes: i });
        const moonIllumination = suncalc_1.getMoonIllumination(calculationMoment.toJSDate());
        moonIlluminationMoments.push({
            moment: calculationMoment,
            illuminationFraction: moonIllumination.fraction,
        });
    }
    const newMoon = lodash_1.minBy(moonIlluminationMoments, (i) => i.illuminationFraction);
    if (!newMoon)
        throw new Error('can`t calculate new moon for: ' + startDate.toISO());
    return newMoon.moment;
};
const getMoonRisesBetween = (params) => {
    const { prevNewMoon, nextNewMoon, coordinates: { lat, lng } } = params;
    const moonRises = [];
    moonRises.push(prevNewMoon.toISO()); // we use exact new moon moment as moon moth boundary
    const hoursBetweenNewMoons = Math.floor(nextNewMoon.diff(prevNewMoon, 'hours').hours);
    for (let i = 0; i <= hoursBetweenNewMoons; i++) {
        const moonTimesAtSomeMomentOfMonth = suncalc_1.getMoonTimes(prevNewMoon.plus({ hours: i }).toJSDate(), lat, lng, true);
        if (!moonTimesAtSomeMomentOfMonth.rise)
            continue;
        const moonRiseMoment = luxon_1.DateTime.fromJSDate(moonTimesAtSomeMomentOfMonth.rise);
        if (moonRiseMoment >= prevNewMoon && moonRiseMoment <= nextNewMoon) {
            moonRises.push(moonRiseMoment.toISO());
        }
    }
    moonRises.push(nextNewMoon.toISO()); // we use exact new moon moment as moon moth boundary
    const uniqMoonRises = lodash_1.uniq(moonRises);
    return uniqMoonRises.map(ISODate => luxon_1.DateTime.fromISO(ISODate));
};
const convertMoonRisesToDays = (moonRises) => {
    const moonDays = [];
    for (let i = 0; i < moonRises.length - 1; i++) {
        moonDays.push({
            dayNumber: i + 1,
            dayStart: moonRises[i],
            dayEnd: moonRises[i + 1]
        });
    }
    return moonDays;
};
exports.calculateMoonDayFor = (date, coordinates) => {
    const prevNewMoon = getNewMoonDate({ startDate: date, shouldCalcPrevNewMoon: true });
    const nextNewMoon = getNewMoonDate({ startDate: date });
    const moonRisesAtSoughtMonth = getMoonRisesBetween({ prevNewMoon, nextNewMoon, coordinates });
    const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth);
    return moonDays.find(d => date >= d.dayStart && date <= d.dayEnd);
};
