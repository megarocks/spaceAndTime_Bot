"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const mongodb_1 = require("mongodb");
const luxon_1 = require("luxon");
const geo_tz_1 = __importDefault(require("geo-tz"));
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const suncalc_1 = __importDefault(require("suncalc"));
const moonCalc_1 = require("./moonCalc");
const utils_1 = require("./utils");
const mongoUri = process.env.MONGODB_URI || '';
let db;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const mongoClient = yield mongodb_1.MongoClient.connect(mongoUri, { useNewUrlParser: true });
            db = mongoClient.db();
            const chatsCollection = db.collection('chats');
            const chats = yield chatsCollection.find({}).toArray();
            const messageSendingJobs = chats.map(chat => sendingJob(chat));
            const sendingResults = yield Promise.all(messageSendingJobs);
            const successFullSendingResults = sendingResults.filter(sr => !!sr);
            console.log(`${successFullSendingResults.length} notifications successfully sent`);
            const resultsSavingJobs = successFullSendingResults.map(databaseSavingJob);
            yield Promise.all(resultsSavingJobs);
        }
        catch (e) {
            console.error('Error while performing batch sending');
            console.error(e);
        }
    });
}
function sendingJob(chat) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { chatId, location: { coordinates: [lng = null, lat = null] = [] } = {} } = chat;
            if (!lat || !lng)
                throw new Error(`no coordinates for chat: ${chatId}`);
            const [timeZone] = geo_tz_1.default(lat, lng);
            if (!timeZone)
                throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`);
            const messagesArray = [];
            const calculationDate = luxon_1.DateTime.utc();
            //common message
            let commonMessage = `⏰ Рассчетное время: ${calculationDate.setZone(timeZone).toLocaleString(luxon_1.DateTime.DATETIME_MED)}\n`;
            commonMessage += `🌐 Временная зона: ${timeZone}\n`;
            messagesArray.push(commonMessage);
            //moon message
            const moonDay = moonCalc_1.calculateMoonDayFor(calculationDate.toJSDate(), { lng, lat });
            const moonRelatedMessage = getMoonNewsMessage({
                moonDay,
                chat,
                timeZone,
            });
            messagesArray.push(moonRelatedMessage);
            //solar message
            const solarRelatedMessage = getSolarNewsMessage({ calculationDate, chat, timeZone });
            messagesArray.push(solarRelatedMessage);
            //final message
            const meaningFullMessages = messagesArray.filter(m => m);
            if (meaningFullMessages.length < 2)
                return; // if no messages or only common message - no sense to send
            const reportMessage = meaningFullMessages.join('\n');
            //send request
            const requestOptions = {
                method: 'POST',
                uri: `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
                json: true,
                body: {
                    chat_id: chatId,
                    text: reportMessage,
                    parse_mode: 'Markdown'
                },
                simple: false
            };
            const response = yield request_promise_native_1.default(requestOptions);
            //send results
            if (!response.ok)
                throw new Error(response.description);
            const { dayNumber: moonDayNumber = null } = moonDay || {};
            let notificationResult = {
                chatId
            };
            if (solarRelatedMessage)
                notificationResult.solarDateNotified = calculationDate.toJSDate();
            if (moonRelatedMessage)
                notificationResult.moonDayNumber = moonDayNumber;
            return notificationResult;
        }
        catch (e) {
            console.log('Error while sending message');
            console.error(e.message);
        }
    });
}
function getMoonNewsMessage(options) {
    const { moonDay, chat, timeZone } = options;
    if (!moonDay) {
        console.warn(`Moon day was not calculated for: ${chat.chatId} at ${new Date().toISOString()}`);
        return;
    }
    if (chat.moonDayNotified === moonDay.dayNumber)
        return; // means already notified
    return utils_1.createReportMessage({ moonDay, timeZone });
}
function getSolarNewsMessage(options) {
    const { chat: { location: { coordinates: [lng, lat] }, solarDateNotified }, calculationDate, timeZone } = options;
    const chatSolarDateNotified = luxon_1.DateTime.fromJSDate(solarDateNotified);
    console.log({
        solarDateNotified,
        chatSolarDateNotified: chatSolarDateNotified.toLocaleString(),
        'sameDate': calculationDate.hasSame(chatSolarDateNotified, 'day')
    });
    if (calculationDate.hasSame(chatSolarDateNotified, 'day'))
        return; // calculation date should be other than solarDateNotified
    const sunTimesToday = suncalc_1.default.getTimes(calculationDate.toJSDate(), lat, lng);
    const sunRiseToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunrise);
    const sunSetToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunset);
    const dayLength = sunSetToday.diff(sunRiseToday, ['hours', 'minutes']);
    console.log({
        sunRiseToday: sunRiseToday.toISO(),
        calculationDate: calculationDate.toISO(),
        'lessThenSunRise': calculationDate < sunRiseToday
    });
    if (calculationDate < sunRiseToday)
        return; // sunrise should be already there
    const sunTimesYesterday = suncalc_1.default.getTimes(calculationDate.minus({ days: 1 }).toJSDate(), lat, lng);
    const sunSetYtd = luxon_1.DateTime.fromJSDate(sunTimesYesterday.sunset);
    const nightLength = sunRiseToday.diff(sunSetYtd, ['hours', 'minutes']);
    const [dayPercent, nightPercent] = getPercentRelation([
        dayLength.as('milliseconds'),
        nightLength.as('milliseconds')
    ]);
    return `☀️ Солнце:
🌅 восход:\t ${sunRiseToday.setZone(timeZone).toLocaleString(luxon_1.DateTime.TIME_24_SIMPLE)}
🌇 закат:\t ${sunSetToday.setZone(timeZone).toLocaleString(luxon_1.DateTime.TIME_24_SIMPLE)}
🏙️ дня:\t ${dayPercent.toFixed(1)} %
🌃 ночи:\t ${nightPercent.toFixed(1)} %`;
}
function getPercentRelation(values) {
    const hundredPercent = values.reduce((acc, val) => acc + val, 0);
    return values.map(value => value * 100 / hundredPercent);
}
function databaseSavingJob(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return db
                .collection('chats')
                .updateOne({ chatId: data.chatId }, {
                $set: data
            });
        }
        catch (e) {
            console.log(JSON.stringify(data) + ' failed to save to DB');
            console.error(e);
        }
    });
}
main().then(() => {
    console.log('\nmain finished');
    process.exit();
});
