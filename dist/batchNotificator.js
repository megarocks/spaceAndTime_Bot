"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotEnv = __importStar(require("dotenv"));
dotEnv.config();
const geo_tz_1 = __importDefault(require("geo-tz"));
const luxon_1 = require("luxon");
const mongodb_1 = require("mongodb");
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
            const notificationJobs = chats.map(createNotificationJob);
            const notificationResults = yield Promise.all(notificationJobs);
            const successfulNotificationResults = notificationResults.filter(sr => !!sr);
            console.log(`${successfulNotificationResults.length} notifications successfully sent`);
            const resultsSavingJobs = successfulNotificationResults.map(createDbSavingJob);
            yield Promise.all(resultsSavingJobs);
        }
        catch (e) {
            console.error('Error while performing batch sending');
            console.error(e);
        }
    });
}
function createNotificationJob(chat) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { chatId, location: { coordinates: [lng = null, lat = null] = [] } = {} } = chat;
            if (!lat || !lng) {
                throw new Error(`no coordinates for chat: ${chatId}`);
            }
            const [timeZone] = geo_tz_1.default(lat, lng);
            if (!timeZone) {
                throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`);
            }
            const messagesArray = [];
            const calculationDate = luxon_1.DateTime.utc();
            // common message
            let commonMessage = `⏰ время: ${calculationDate
                .setZone(timeZone)
                .setLocale('ru')
                .toLocaleString(luxon_1.DateTime.DATETIME_SHORT)}\n`;
            commonMessage += `🌐 часовой пояс: ${timeZone}\n`;
            messagesArray.push(commonMessage);
            // solar message
            const solarRelatedMessage = getSolarNewsMessage({
                calculationDate,
                chat,
                timeZone,
            });
            messagesArray.push(solarRelatedMessage);
            // moon message
            const moonDay = moonCalc_1.calculateMoonDayFor(calculationDate, { lng, lat });
            const moonRelatedMessage = getMoonNewsMessage({
                chat,
                moonDay,
                timeZone,
            });
            messagesArray.push(moonRelatedMessage);
            // final message
            const meaningFullMessages = messagesArray.filter(m => m);
            if (meaningFullMessages.length < 2) {
                return;
            } // if no messages or only common message - no sense to send
            const reportMessage = meaningFullMessages.join('\n');
            const recipientTime = calculationDate.setZone(timeZone);
            // send request
            const requestOptions = {
                body: {
                    chat_id: chatId,
                    disable_notification: recipientTime.hour < 8 || recipientTime.hour > 22,
                    parse_mode: 'Markdown',
                    text: reportMessage,
                },
                json: true,
                method: 'POST',
                simple: false,
                uri: `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
            };
            const response = yield request_promise_native_1.default(requestOptions);
            // send results
            if (!response.ok) {
                throw new Error(response.description);
            }
            const notificationResult = {
                chatId,
            };
            if (solarRelatedMessage) {
                notificationResult.solarDateNotified = calculationDate.toJSDate();
            }
            if (moonDay && moonRelatedMessage) {
                notificationResult.moonDayNotified = moonDay.dayNumber;
            }
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
    if (chat.moonDayNotified === moonDay.dayNumber) {
        return;
    } // means already notified
    return utils_1.createMoonMessage({ moonDay, timeZone });
}
function getSolarNewsMessage(options) {
    const { chat: { location: { coordinates: [lng, lat], }, solarDateNotified, }, calculationDate, timeZone, } = options;
    if (solarDateNotified && calculationDate.hasSame(luxon_1.DateTime.fromJSDate(solarDateNotified), 'day')) {
        return;
    }
    const sunTimesToday = suncalc_1.default.getTimes(calculationDate.toJSDate(), lat, lng);
    const sunRiseToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunrise);
    const sunSetToday = luxon_1.DateTime.fromJSDate(sunTimesToday.sunset);
    const dayLength = sunSetToday.diff(sunRiseToday, ['hours', 'minutes']);
    if (calculationDate < sunRiseToday) {
        return;
    } // sunrise should be already there
    const sunTimesYesterday = suncalc_1.default.getTimes(calculationDate.minus({ days: 1 }).toJSDate(), lat, lng);
    const sunSetYtd = luxon_1.DateTime.fromJSDate(sunTimesYesterday.sunset);
    const nightLength = sunRiseToday.diff(sunSetYtd, ['hours', 'minutes']);
    const [dayPercent, nightPercent] = utils_1.getPercentRelation([dayLength.as('milliseconds'), nightLength.as('milliseconds')]);
    return utils_1.createSolarMessage({
        dayPercent,
        nightPercent,
        sunRiseToday,
        sunSetToday,
        timeZone,
    });
}
function createDbSavingJob(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return db.collection('chats').updateOne({ chatId: data.chatId }, {
                $set: data,
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
