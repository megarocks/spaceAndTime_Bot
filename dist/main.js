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
const luxon_1 = require("luxon");
const micro_bot_1 = require("micro-bot");
const extra_1 = __importDefault(require("telegraf/extra"));
const markup_1 = __importDefault(require("telegraf/markup"));
const session_1 = __importDefault(require("telegraf/session"));
const stage_1 = __importDefault(require("telegraf/stage"));
const base_1 = __importDefault(require("telegraf/scenes/base"));
const mongodb_1 = require("mongodb");
const geo_tz_1 = __importDefault(require("geo-tz"));
const utils_1 = require("./utils");
const { enter, leave } = stage_1.default;
const googleMapsClient = require('@google/maps').createClient({ Promise: Promise });
const moonCalc = require('./moonCalc');
const sendLocationKeyboard = extra_1.default.markup((markup) => markup.keyboard([markup.locationRequestButton('📍 Оправить координаты!')]).oneTime().resize());
const removeKb = markup_1.default.removeKeyboard().extra();
const app = new micro_bot_1.Composer();
app.use(session_1.default());
const setLocationScene = new base_1.default('location');
setLocationScene.enter((ctx) => __awaiter(this, void 0, void 0, function* () {
    return ctx.reply('Напиши где ты находишься, или пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку.\n', sendLocationKeyboard);
}));
setLocationScene.on('location', (ctx) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { message: { location: { latitude: lat, longitude: lng } } } = ctx;
        if (!lat || !lng)
            return ctx.reply('Не могу определить координаты. Проверь службы геолокации');
        yield saveCoordinatesToChatsCollection(ctx, { lat, lng });
        yield ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lng}\nШирота: ${lat}\n`);
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc().toJSDate(), { lat, lng });
        const reportMessage = utils_1.createReportMessage({ moonDay, timeZone });
        yield ctx.replyWithMarkdown(reportMessage, removeKb);
    }
    catch (err) {
        console.error(err);
        yield ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb);
    }
    finally {
        leave();
    }
}));
setLocationScene.on('text', (ctx) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { message: { text } } = ctx;
        const geoCodingResponse = yield googleMapsClient.geocode({ address: text }).asPromise();
        if (!geoCodingResponse.json.results.length)
            return ctx.reply(`Не удалось определить координаты: ${text}.` +
                `Попробуй ввести официальное название ближайшего населённого пункта`);
        const { json: { results: [{ geometry: { location: { lat, lng } } }] } } = geoCodingResponse;
        yield saveCoordinatesToChatsCollection(ctx, { lat, lng });
        yield ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lat}\nШирота: ${lng}\n`);
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc().toJSDate(), { lat, lng });
        const reportMessage = utils_1.createReportMessage({ moonDay, timeZone });
        yield ctx.replyWithMarkdown(reportMessage, removeKb);
    }
    catch (e) {
        console.error(e);
        yield ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb);
    }
    finally {
        leave();
    }
}));
const stage = new stage_1.default([setLocationScene], { ttl: 10 });
app.use(stage.middleware());
app.start((ctx) => __awaiter(this, void 0, void 0, function* () {
    yield ctx.reply(utils_1.createStartMessage());
}));
app.help((ctx) => __awaiter(this, void 0, void 0, function* () {
    yield ctx.reply(utils_1.createHelpMessage());
}));
app.command('location', enter('location'));
app.command('day', (ctx) => __awaiter(this, void 0, void 0, function* () {
    try {
        //@ts-ignore
        const chat = yield ctx.db.collection('chats').findOne({ chatId: ctx.message.chat.id });
        if (!chat)
            return ctx.reply('Используйте команду /location чтобы задать своё местоположение');
        const { location: { coordinates: [lng, lat] } } = chat;
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc().toJSDate(), { lat, lng });
        const reportMessage = utils_1.createReportMessage({ moonDay, timeZone });
        return ctx.replyWithMarkdown(reportMessage);
    }
    catch (err) {
        console.error(err);
        ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу');
    }
}));
module.exports = {
    initialize: (app) => __awaiter(this, void 0, void 0, function* () {
        const mongoUri = process.env.MONGODB_URI || '';
        const mongoClient = yield mongodb_1.MongoClient.connect(mongoUri, { useNewUrlParser: true });
        app.context.db = mongoClient.db();
        console.log(`DB ${app.context.db.databaseName} is initialized`);
    }),
    botHandler: app
};
function saveCoordinatesToChatsCollection(ctx, coordinates) {
    return __awaiter(this, void 0, void 0, function* () {
        const { lng, lat } = coordinates;
        //@ts-ignore
        const chatsCollection = ctx.db.collection('chats');
        return chatsCollection.updateOne({ chatId: ctx.message.chat.id }, { $set: { chatId: ctx.message.chat.id, location: { type: 'Point', coordinates: [lng, lat] } } }, { upsert: true });
    });
}
