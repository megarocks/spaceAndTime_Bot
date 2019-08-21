"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const d3_scale_1 = require("d3-scale");
const lodash_1 = require("lodash");
const luxon_1 = require("luxon");
const suncalc_1 = require("suncalc");
exports.isBeforeFullMoonAt = (moment) => {
    const currentIllumination = suncalc_1.getMoonIllumination(moment.toJSDate()).fraction;
    const nextMomentIllumination = suncalc_1.getMoonIllumination(moment.plus({ minutes: 1 }).toJSDate()).fraction;
    return nextMomentIllumination > currentIllumination;
};
exports.getNewMoonDate = (params) => {
    const { startDate, isTravelingToPast } = params;
    const isBeforeFullMoon = exports.isBeforeFullMoonAt(startDate);
    const moonIlluminationMoments = [];
    for (let i = 0; i < 717 * 60; i++) {
        // up to 717 hours per lunar month
        if (isBeforeFullMoon && !isTravelingToPast && i < 175 * 60) {
            continue;
        }
        if (isBeforeFullMoon && isTravelingToPast && i >= 375 * 60) {
            break;
        }
        if (!isBeforeFullMoon && !isTravelingToPast && i >= 375 * 60) {
            break;
        }
        if (!isBeforeFullMoon && isTravelingToPast && i < 175 * 60) {
            continue;
        }
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
    return moonDays.find(d => date >= d.dayStart && date <= d.dayEnd);
};
const phases = [
    { symbol: '🌚', label: 'новая луна' },
    { symbol: '🌒', label: 'молодая луна' },
    { symbol: '🌓', label: 'первая четверть' },
    { symbol: '🌔', label: 'прибывающая луна' },
    { symbol: '🌕', label: 'полная луна' },
    { symbol: '🌖', label: 'убывающая луна' },
    { symbol: '🌗', label: 'последняя четверть' },
    { symbol: '🌘', label: 'бальзамическая луна' },
];
exports.getMoonPhaseEmojiAndLabelByDate = (date) => {
    const scale = d3_scale_1.scaleQuantize()
        .range(phases)
        .domain([0, 1]);
    const moonIlluminationPhase = suncalc_1.getMoonIllumination(date.toJSDate()).phase;
    return scale(moonIlluminationPhase);
};
