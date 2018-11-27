"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
require('dotenv');
const { DateTime } = require('luxon');
const { Composer } = require('micro-bot');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const MongoClient = require('mongodb').MongoClient;
const geoTz = require('geo-tz');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const { enter, leave } = Stage;
const googleMapsClient = require('@google/maps').createClient({ Promise: Promise });
const dbClient = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true });
const moonCalc = require('./moonCalc');
const sendLocationKeyboard = Extra.markup(markup => markup.keyboard([markup.locationRequestButton('📍 Оправить координаты!')]).oneTime().resize());
const removeKb = Markup.removeKeyboard().extra();
const app = new Composer();
app.use(session());
const setLocationScene = new Scene('location');
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
        const [timeZone] = geoTz(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(DateTime.fromObject({ zone: timeZone }).toJSDate(), { lat, lng });
        const reportMessage = createReportMessage({ moonDay, timeZone });
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
        const [timeZone] = geoTz(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(DateTime.fromObject({ zone: timeZone }).toJSDate(), { lat, lng });
        const reportMessage = createReportMessage({ moonDay, timeZone });
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
const stage = new Stage([setLocationScene], { ttl: 10 });
app.use(stage.middleware());
app.start((ctx) => __awaiter(this, void 0, void 0, function* () {
    yield ctx.reply(createStartMessage());
}));
app.help((ctx) => __awaiter(this, void 0, void 0, function* () {
    yield ctx.reply(createHelpMessage());
}));
app.command('location', enter('location'));
app.command('day', ({ db, message, reply, replyWithMarkdown }) => __awaiter(this, void 0, void 0, function* () {
    try {
        const chat = yield db.collection('chats').findOne({ chatId: message.chat.id });
        if (!chat)
            return reply('Используйте команду /location чтобы задать своё местоположение');
        const { location: { coordinates: [lng, lat] } } = chat;
        const [timeZone] = geoTz(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc().setZone(timeZone).toJSDate(), { lat, lng });
        const reportMessage = createReportMessage({ moonDay, timeZone });
        return replyWithMarkdown(reportMessage);
    }
    catch (err) {
        console.error(err);
        reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу');
    }
}));
module.exports = {
    initialize: (bot) => __awaiter(this, void 0, void 0, function* () {
        yield dbClient.connect();
        bot.context.db = dbClient.db();
        console.log(`DB ${bot.context.db.databaseName} is initialized`);
    }),
    botHandler: app
};
function createReportMessage({ moonDay, timeZone }) {
    if (!moonDay)
        return 'Не могу рассчитать лунный день. Странная астрологическая обстановка. Учти это';
    const { dayNumber, dayStart, dayEnd } = moonDay;
    let leftHours = Math.floor(dayEnd.setZone(timeZone).diff(DateTime.utc().setZone(timeZone), 'hours').hours);
    let leftHoursMessage = leftHours ? `Через ${leftHours} ${getNoun(leftHours, 'час', 'часа', 'часов')}` : 'менее чем через час';
    let reportMessage = `Текущий лунный день: *${dayNumber}*
День начался: _${dayStart.setZone(timeZone).setLocale('ru').toLocaleString(DateTime.DATETIME_SHORT)}_
День завершится: _${dayEnd.setZone(timeZone).setLocale('ru').toLocaleString(DateTime.DATETIME_SHORT)}_
Начало следующего: _${leftHoursMessage}_
`;
    return reportMessage;
}
function createStartMessage() {
    return `Привет
Буду оповещать тебя о начале нового лунного дня и месяца, фазах луны, и других натуральных циклах нашей планеты
Доступные команды:
/location - задать своё местоположение
/day - получить информацию о текущем дне`;
}
function createHelpMessage() {
    return 'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
        'Буду оповещать тебя о начале нового лунного дня, и месяца, фазах луны, и других натуральных циклах нашей планеты\n' +
        'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps';
}
function getNoun(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) {
        return five;
    }
    n %= 10;
    if (n === 1) {
        return one;
    }
    if (n >= 2 && n <= 4) {
        return two;
    }
    return five;
}
function saveCoordinatesToChatsCollection(ctx, coordinates) {
    return __awaiter(this, void 0, void 0, function* () {
        const { lng, lat } = coordinates;
        const chatsCollection = ctx.db.collection('chats');
        return chatsCollection.updateOne({ chatId: ctx.message.chat.id }, { $set: { chatId: ctx.message.chat.id, location: { type: 'Point', coordinates: [lng, lat] } } }, { upsert: true });
    });
}
//# sourceMappingURL=main.js.map