require('dotenv').config();

import { DateTime } from 'luxon';
import { Composer } from 'micro-bot';
import { ContextMessageUpdate } from 'telegraf';
import Extra from 'telegraf/extra';
import Markup from 'telegraf/markup';
import session from 'telegraf/session';
import Stage from 'telegraf/stage';
import Scene from 'telegraf/scenes/base';
import {MongoClient} from 'mongodb'
import geoTz from 'geo-tz';

import {createHelpMessage, createMoonMessage, createStartMessage} from "./utils";

const { enter, leave } = Stage;

const googleMapsClient = require('@google/maps').createClient({ Promise: Promise });

const moonCalc = require('./moonCalc');

const sendLocationKeyboard = Extra.markup((markup: Markup) => markup.keyboard([markup.locationRequestButton('📍 Оправить координаты!')]).oneTime().resize())
const removeKb = Markup.removeKeyboard().extra();

const app = new Composer();
app.use(session());

const setLocationScene = new Scene('location');
setLocationScene.enter(async (ctx: ContextMessageUpdate) => {
  return ctx.reply(
    'Напиши где ты находишься, или пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку.\n',
    sendLocationKeyboard
  )
});
setLocationScene.on('location', async (ctx: ContextMessageUpdate) => {
  try {
    const {message: {location: {latitude: lat, longitude: lng}}} = ctx;

    if (!lat || !lng)
      return ctx.reply('Не могу определить координаты. Проверь службы геолокации');

    await saveCoordinatesToChatsCollection(ctx, {lat, lng});
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lng}\nШирота: ${lat}\n`);

    const [timeZone] = geoTz(lat, lng);
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc().toJSDate(), {lat, lng});
    const reportMessage = createMoonMessage({moonDay, timeZone});
    await ctx.replyWithMarkdown(reportMessage, removeKb);
  } catch (err) {
    console.error(err);
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb);
  } finally {
    leave()
  }
});
setLocationScene.on('text', async (ctx: ContextMessageUpdate) => {
  try {
    const { message: { text } } = ctx
    const geoCodingResponse = await googleMapsClient.geocode({ address: text }).asPromise();
    if (!geoCodingResponse.json.results.length)
      return ctx.reply(`Не удалось определить координаты: ${text}.` +
       `Попробуй ввести официальное название ближайшего населённого пункта`);

    const { json: { results: [ { geometry: { location: { lat, lng } } } ] } } = geoCodingResponse;

    await saveCoordinatesToChatsCollection(ctx, { lat, lng });
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lat}\nШирота: ${lng}\n`);

    const [timeZone] = geoTz(lat, lng);
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc().toJSDate(), {lat, lng});
    const reportMessage = createMoonMessage({moonDay, timeZone})
    await ctx.replyWithMarkdown(reportMessage, removeKb)
  } catch (e) {
    console.error(e);
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
  } finally {
    leave()
  }
});

const stage = new Stage([setLocationScene], { ttl: 10 });
app.use(stage.middleware());

app.start(async (ctx: ContextMessageUpdate) => {
  await ctx.reply(createStartMessage());
});
app.help(async (ctx: ContextMessageUpdate) => {
  await ctx.reply(createHelpMessage())
});

app.command('location', enter('location'));
app.command('day', async (ctx: ContextMessageUpdate) => {
  try {
    //@ts-ignore
    const chat = await ctx.db.collection('chats').findOne({chatId: ctx.message.chat.id});
    if (!chat) return ctx.reply('Используйте команду /location чтобы задать своё местоположение')

    const { location: {coordinates: [lng, lat]} } = chat;
    const [timeZone] = geoTz(lat, lng);
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc().toJSDate(), {lat, lng});
    const reportMessage = createMoonMessage({moonDay, timeZone})
    return ctx.replyWithMarkdown(reportMessage)
  } catch (err) {
    console.error(err)
    ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу')
  }
});

module.exports = {
  initialize: async app => {
    const mongoUri = process.env.MONGODB_URI || '';
    const mongoClient = await MongoClient.connect(mongoUri, {useNewUrlParser: true});
    app.context.db = mongoClient.db();
    console.log(`DB ${app.context.db.databaseName} is initialized`);
  },
  botHandler: app
};


async function saveCoordinatesToChatsCollection(ctx: ContextMessageUpdate, coordinates: {lat: number, lng: number}) {
  const {lng, lat} = coordinates;
  //@ts-ignore
  const chatsCollection = ctx.db.collection('chats')
  return chatsCollection.updateOne(
    {chatId: ctx.message.chat.id},
    {$set: {chatId: ctx.message.chat.id, location: { type: 'Point', coordinates: [lng, lat]} }},
    {upsert: true}
  );
}
