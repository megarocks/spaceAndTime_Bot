"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config({ debug: true });
const mongodb_1 = require("mongodb");
const luxon_1 = require("luxon");
const moonCalc_1 = require("./moonCalc");
const mongoUri = process.env.MONGODB_URI || '';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const mongoClient = yield mongodb_1.MongoClient.connect(mongoUri, { useNewUrlParser: true });
            const db = mongoClient.db();
            const chatsCollection = db.collection('chats');
            const chats = yield chatsCollection.find({}).toArray();
            const messageSendingJobs = chats.map(sendingJob);
            return Promise.all(messageSendingJobs);
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
            const moonDay = moonCalc_1.calculateMoonDayFor(luxon_1.DateTime.utc().toJSDate(), {
                lng: coordinates[0],
                lat: coordinates[1]
            });
            console.log({ chatId, moonDay: moonDay.dayNumber });
        }
        catch (e) {
            console.log('Error while sending message');
            console.error(e);
        }
    });
}
main().then(() => {
    console.log('\nmain finished');
    process.exit();
});
