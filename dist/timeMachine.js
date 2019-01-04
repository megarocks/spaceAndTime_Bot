"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const suncalc_1 = __importDefault(require("suncalc"));
const moonCalc_1 = require("./moonCalc");
function* timeMachine({ start, end, stepUnit = 'days', step = 1, lat = 52.3679843, lng = 4.9035614, }) {
    if (step === 0) {
        throw new Error('Step may not be 0');
    }
    if (end && step > 0 && start > end) {
        throw new Error('You can`t travel to future when end of the trip in the past');
    }
    if (end && step < 0 && end > start) {
        throw new Error('You can`t travel to past when end of the trip in the future');
    }
    let counter = 0;
    const isTravelFinished = () => {
        if (!end) {
            return false;
        }
        const isMovingToFuture = step > 0;
        if (isMovingToFuture) {
            return start.plus({ [stepUnit]: counter }) > end;
        }
        else {
            return start.plus({ [stepUnit]: counter }) < end;
        }
    };
    while (!isTravelFinished()) {
        const currentDate = start.plus({ [stepUnit]: counter });
        const sunTimesToday = suncalc_1.default.getTimes(currentDate.toJSDate(), lat, lng);
        const sunTimesYesterday = suncalc_1.default.getTimes(currentDate.minus({ days: 1 }).toJSDate(), lat, lng);
        const sunRiseToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunrise);
        const sunSetToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunset);
        const sunSetYesterday = luxon_1.DateTime.fromJSDate(sunTimesYesterday.sunset);
        const dayLength = sunSetToday.diff(sunRiseToday);
        const nightLength = sunRiseToday.diff(sunSetYesterday);
        const moonIllumination = suncalc_1.default.getMoonIllumination(currentDate.toJSDate());
        const moonDay = moonCalc_1.calculateMoonDayFor(currentDate, { lat, lng });
        yield {
            dateTime: currentDate,
            dayLength,
            moonDay,
            moonIllumination,
            nightLength,
        };
        counter += step;
    }
}
exports.default = timeMachine;
