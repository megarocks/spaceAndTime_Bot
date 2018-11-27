import {DateTime} from "luxon";
import {getMoonTimes, getMoonIllumination} from "suncalc";
import {minBy, uniq} from "lodash";
import {MoonDay} from "./utils";

const getNewMoonDate = (params: {
    startDate: DateTime,
    shouldCalcPrevNewMoon?: boolean
}): DateTime => {
    const {startDate} = params;
    const moonIlluminationMoments = [];
    for (let i = 0; i < 60 * 24 * 30; i++) {
        let calculationMoment: DateTime;
        if (params.shouldCalcPrevNewMoon)
            calculationMoment = startDate.minus({minutes: i});
        else
            calculationMoment = startDate.plus({minutes: i});

        const moonIllumination = getMoonIllumination(calculationMoment.toJSDate());

        moonIlluminationMoments.push({
            moment: calculationMoment,
            illuminationFraction: moonIllumination.fraction,
        });
    }
    const newMoon = minBy(moonIlluminationMoments, (i) => i.illuminationFraction);
    if (!newMoon) throw new Error('can`t calculate new moon for: ' + startDate.toISO());

    return newMoon.moment
};

const getMoonRisesBetween = (params: {
    prevNewMoon: DateTime,
    nextNewMoon: DateTime,
    coordinates: { lat: number, lng: number }
}): DateTime[] => {
    const {prevNewMoon, nextNewMoon, coordinates: {lat, lng}} = params;
    const moonRises = [];

    moonRises.push(prevNewMoon.toISO()); // we use exact new moon moment as moon moth boundary

    const hoursBetweenNewMoons = Math.floor(nextNewMoon.diff(prevNewMoon, 'hours').hours);
    for (let i = 0; i <= hoursBetweenNewMoons; i++) {
        const moonTimesAtSomeMomentOfMonth = getMoonTimes(prevNewMoon.plus({hours: i}).toJSDate(), lat, lng, true);
        if (!moonTimesAtSomeMomentOfMonth.rise) continue;

        const moonRiseMoment = DateTime.fromJSDate(moonTimesAtSomeMomentOfMonth.rise);
        if (moonRiseMoment >= prevNewMoon && moonRiseMoment <= nextNewMoon) {
            moonRises.push(moonRiseMoment.toISO())
        }
    }

    moonRises.push(nextNewMoon.toISO());  // we use exact new moon moment as moon moth boundary

    const uniqMoonRises = uniq(moonRises);
    return uniqMoonRises.map(ISODate => DateTime.fromISO(ISODate))
};

const convertMoonRisesToDays = (
    moonRises: DateTime[]
): MoonDay[] => {
    const moonDays = [];
    for (let i = 0; i < moonRises.length - 1; i++) {
        moonDays.push({
            dayNumber: i + 1,
            dayStart: moonRises[i],
            dayEnd: moonRises[i + 1]
        })
    }
    return moonDays
};

export const calculateMoonDayFor = (
    date: Date,
    coordinates: { lat: number, lng: number }
): MoonDay | undefined => {
    const targetDate = DateTime.fromJSDate(date);

    const prevNewMoon = getNewMoonDate({startDate: targetDate, shouldCalcPrevNewMoon: true});
    const nextNewMoon = getNewMoonDate({startDate: targetDate,});

    const moonRisesAtSoughtMonth = getMoonRisesBetween({prevNewMoon, nextNewMoon, coordinates});

    const moonDays = convertMoonRisesToDays(moonRisesAtSoughtMonth);

    return moonDays.find(d => targetDate >= d.dayStart && targetDate <= d.dayEnd);
};