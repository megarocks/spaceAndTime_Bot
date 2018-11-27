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
const calculateMoonDayFor = (date, coordinates) => {
    validateInput({ date, coordinates });
    const targetDate = luxon_1.DateTime.fromJSDate(date);
    const prevNewMoon = getNewMoonDate({ startDate: targetDate, shouldCalcPrevNewMoon: true });
    const nextNewMoon = getNewMoonDate({ startDate: targetDate, });
    const moonRisesAtSoughtMonth = getMoonRisesBetween({ prevNewMoon, nextNewMoon, coordinates });
    const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth);
    return moonDays.find(d => targetDate >= d.dayStart && targetDate <= d.dayEnd);
};
function validateInput(params) {
    if (!params.date)
        throw new Error('invalid date');
    if (Object.prototype.toString.call(params.date) !== '[object Date]')
        throw new Error('invalid date');
    if (!params.coordinates)
        throw new Error('coordinates are required');
    if (typeof params.coordinates.lat !== 'number')
        throw new Error('latitude should be a number');
    if (typeof params.coordinates.lng !== 'number')
        throw new Error('longitude should be a number');
    return;
}
module.exports = {
    calculateMoonDayFor
};
//# sourceMappingURL=moonCalc.js.map