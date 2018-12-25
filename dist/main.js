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
const maps_1 = __importDefault(require("@google/maps"));
const geo_tz_1 = __importDefault(require("geo-tz"));
const luxon_1 = require("luxon");
const micro_bot_1 = require("micro-bot");
const mongodb_1 = require("mongodb");
const extra_1 = __importDefault(require("telegraf/extra"));
const markup_1 = __importDefault(require("telegraf/markup"));
const base_1 = __importDefault(require("telegraf/scenes/base"));
const session_1 = __importDefault(require("telegraf/session"));
const stage_1 = __importDefault(require("telegraf/stage"));
const moonCalc = __importStar(require("./moonCalc"));
const utils_1 = require("./utils");
const { enter, leave } = stage_1.default;
const googleMapsClient = maps_1.default.createClient({
    Promise,
});
const sendLocationKeyboard = extra_1.default.markup((markup) => markup
    .keyboard([markup.locationRequestButton('📍 Оправить координаты!')])
    .oneTime()
    .resize());
const removeKb = markup_1.default.removeKeyboard().extra();
const app = new micro_bot_1.Composer();
app.use(session_1.default());
const setLocationScene = new base_1.default('location');
setLocationScene.enter((ctx) => __awaiter(this, void 0, void 0, function* () {
    return ctx.reply('Напиши где ты находишься, или пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку.\n', sendLocationKeyboard);
}));
setLocationScene.on('location', (ctx) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { message: { chat: { id: chatId = null } = {}, location: { latitude: lat = null, longitude: lng = null } = {} } = {} } = ctx;
        if (!chatId) {
            throw new Error(`chat id is not defined`);
        }
        if (!lat || !lng) {
            return ctx.reply('Не могу определить координаты. Проверь службы геолокации');
        }
        yield saveCoordinatesToChatsCollection(ctx.db, chatId, { lat, lng });
        yield ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lng}\nШирота: ${lat}\n`);
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc(), { lat, lng });
        if (!moonDay) {
            return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`);
        }
        const reportMessage = utils_1.createMoonMessage({ moonDay, timeZone });
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
        const { chat: { id: chatId = null } = {}, message: { text = '' } = {} } = ctx;
        if (!chatId) {
            throw new Error(`chat id is not defined`);
        }
        const geoCodingResponse = yield googleMapsClient.geocode({ address: text }).asPromise();
        if (!geoCodingResponse.json.results.length) {
            return ctx.reply(`Не удалось определить координаты: ${text}.` + `Попробуй ввести официальное название ближайшего населённого пункта`);
        }
        const { json: { results: [{ geometry: { location: { lat, lng }, }, },], }, } = geoCodingResponse;
        yield saveCoordinatesToChatsCollection(ctx.db, chatId, { lat, lng });
        yield ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lat}\nШирота: ${lng}\n`);
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc(), { lat, lng });
        if (!moonDay) {
            return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`);
        }
        const reportMessage = utils_1.createMoonMessage({ moonDay, timeZone });
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
        const { message: { chat: { id: chatId = null } = {} } = {} } = ctx;
        const chat = yield ctx.db.collection('chats').findOne({ chatId });
        if (!chat) {
            return ctx.reply('Используйте команду /location чтобы задать своё местоположение');
        }
        const { location: { coordinates: [lng, lat], }, } = chat;
        const [timeZone] = geo_tz_1.default(lat, lng);
        const moonDay = moonCalc.calculateMoonDayFor(luxon_1.DateTime.utc(), { lat, lng });
        if (!moonDay) {
            return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`);
        }
        const reportMessage = utils_1.createMoonMessage({ moonDay, timeZone });
        return ctx.replyWithMarkdown(reportMessage);
    }
    catch (err) {
        console.error(err);
        ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу');
    }
}));
module.exports = {
    botHandler: app,
    initialize: (botApp) => __awaiter(this, void 0, void 0, function* () {
        const mongoUri = process.env.MONGODB_URI || '';
        const mongoClient = yield mongodb_1.MongoClient.connect(mongoUri, { useNewUrlParser: true });
        botApp.context.db = mongoClient.db();
        console.log(`DB ${botApp.context.db.databaseName} is initialized`);
    }),
};
function saveCoordinatesToChatsCollection(db, chatId, coordinates) {
    return __awaiter(this, void 0, void 0, function* () {
        const { lng, lat } = coordinates;
        const chatsCollection = db.collection('chats');
        return chatsCollection.updateOne({ chatId }, {
            $set: {
                chatId,
                location: { type: 'Point', coordinates: [lng, lat] },
            },
        }, { upsert: true });
    });
}
