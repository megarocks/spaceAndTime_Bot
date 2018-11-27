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
            const messageSendingJobs = chats.map(sendingJob);
            const sendingResults = yield Promise.all(messageSendingJobs);
            const successFullSendingResults = sendingResults.filter(sr => !!sr);
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
            const { chatId, location: { coordinates = [] } = {} } = chat;
            if (!coordinates.length)
                throw new Error(`no coordinates for chat: ${chatId}`);
            const moonDay = moonCalc_1.calculateMoonDayFor(luxon_1.DateTime.utc().toJSDate(), {
                lng: coordinates[0],
                lat: coordinates[1]
            });
            if (!moonDay)
                throw new Error(`no newMoon day for chat: ${chatId}`);
            if (chat.moonDayNotified === moonDay.dayNumber)
                return; // means already notified
            const { location: { coordinates: [lng, lat] } } = chat;
            const [timeZone] = geo_tz_1.default(lat, lng);
            if (!timeZone)
                throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`);
            const reportMessage = utils_1.createReportMessage({ moonDay, timeZone });
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
            if (!response.ok)
                throw new Error(response.description);
            return { chatId, moonDayNumber: moonDay.dayNumber };
        }
        catch (e) {
            console.log('Error while sending message');
            console.error(e.message);
        }
    });
}
function databaseSavingJob(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return db
                .collection('chats')
                .updateOne({ chatId: data.chatId }, { $set: { moonDayNotified: data.moonDayNumber } });
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
