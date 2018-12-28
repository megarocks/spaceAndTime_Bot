"use strict";
// import Koa from 'koa'
// import route from 'koa-route'
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const suncalc_1 = __importDefault(require("suncalc"));
function* generateChartData({ start, end, stepUnit = 'days', step = 1, lat = 52.3679843, lng = 4.9035614, }) {
    let counter = 0;
    while (start.plus({ [stepUnit]: counter }) <= end) {
        const currentDate = start.plus({ [stepUnit]: counter });
        const sunTimesToday = suncalc_1.default.getTimes(currentDate.toJSDate(), lat, lng);
        const sunTimesYesterday = suncalc_1.default.getTimes(currentDate.minus({ days: 1 }).toJSDate(), lat, lng);
        const sunRiseToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunrise);
        const sunSetToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunset);
        const sunSetYesterday = luxon_1.DateTime.fromJSDate(sunTimesYesterday.sunset);
        const dayLength = sunSetToday.diff(sunRiseToday);
        const nightLength = sunRiseToday.diff(sunSetYesterday);
        const moonIllumination = suncalc_1.default.getMoonIllumination(currentDate.toJSDate());
        yield {
            dateTime: currentDate,
            dayLength,
            moonIllumination,
            nightLength,
        };
        counter++;
    }
}
const dates = [...generateChartData({ start: luxon_1.DateTime.utc(2018, 12, 27), end: luxon_1.DateTime.utc(2018, 12, 31), stepUnit: 'days', step: 1, lat: 52.3, lng: 4.9 })];
console.log(dates.map(d => (Object.assign({}, d, { dateTime: d.dateTime.toISO() }))));
// const app = new Koa()
//
// app.use(route.get('/data', async ctx => {
//
// }))
