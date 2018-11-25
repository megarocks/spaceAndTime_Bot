require('dotenv');
const moment = require('moment');
const {Composer} = require('micro-bot');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const MongoClient = require('mongodb').MongoClient;

const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const { enter, leave } = Stage

const googleMapsClient = require('@google/maps').createClient({ Promise: Promise });

const dbClient = new MongoClient(process.env.MONGODB_URI, {useNewUrlParser: true})

const moonCalc = require('./moonCalc');

const sendLocationKeyboard = Extra.markup(markup => markup.keyboard([markup.locationRequestButton('📍 Оправить координаты!')]).oneTime().resize())
const removeKb = Markup.removeKeyboard().extra()

const app = new Composer();

app.start((ctx) => ctx.reply(
  'Привет. Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день.' +
  'Я запомню эти координаты и буду сообщать о событиях лунного цикла',
  sendLocationKeyboard
  )
);
app.help((ctx) => ctx.reply(
  'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день\n' +
  'Если не удаётся отправить локацию, проверь в настройках, что у телеграм есть доступ к gps',
  sendLocationKeyboard
  )
);

const setLocationScene = new Scene('location');
setLocationScene.enter(async ctx => {
  return ctx.reply(
    'Напиши где ты находишься, или пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку.\n',
    sendLocationKeyboard
  )
});
setLocationScene.on('location', async ctx => {
  try {
    const {message: {location: {latitude: lat, longitude: lng}}} = ctx

    if (!latitude || !longitude)
      return ctx.reply('Не могу определить координаты. Проверь службы геолокации')

    await saveCoordinatesToChatsCollection(ctx, [ lat, lng ])
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lng}\nШирота: ${lat}\n`)

    const moonDay = moonCalc.calculateMoonDayFor(moment(), {lat, lon: lng});
    const reportMessage = createReportMessage({moonDay})
    await ctx.replyWithMarkdown(reportMessage, removeKb)
  } catch (err) {
    console.error(err);
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
  } finally {
    leave()
  }
});
setLocationScene.on('text', async ctx => {
  try {
    const { message: { text } } = ctx
    const geoCodingResponse = await googleMapsClient.geocode({ address: text }).asPromise();
    if (!geoCodingResponse.json.results.length)
      return ctx.reply(`Не удалось определить координаты: ${text}.` +
       `Попробуй ввести официальное название ближайшего населённого пункта`);

    const { json: { results: [ { geometry: { location: { lat, lng } } } ] } } = geoCodingResponse;

    await saveCoordinatesToChatsCollection(ctx, [ lat, lng ]);
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lat}\nШирота: ${lng}\n`);

    const moonDay = moonCalc.calculateMoonDayFor(moment(), {lat, lon: lng});
    const reportMessage = createReportMessage({moonDay})
    await ctx.replyWithMarkdown(reportMessage, removeKb)
    leave()
  } catch (e) {
    console.error(err);
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
  }
})

app.use(session())

const stage = new Stage([setLocationScene], { ttl: 10 })
app.use(stage.middleware())

app.command('location', enter('location'))

app.command('day', async ({db, message, reply, replyWithMarkdown}) => {
  try {
    const chat = await db.collection('chats').findOne({chatId: message.chat.id})
    if (!chat) return reply('Пришли мне свои координаты, потом выполни эту команду снова', sendLocationKeyboard)

    const {coordinates: [lat, lon]} = chat;
    const moonDay = moonCalc.calculateMoonDayFor(moment(), {lat, lon});
    const reportMessage = createReportMessage({moonDay})
    return replyWithMarkdown(reportMessage)
  } catch (err) {
    console.error(err)
    reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу')
  }
})

module.exports = {
  initialize: async bot => {
    await dbClient.connect();
    bot.context.db = dbClient.db();
    console.log(`DB ${bot.context.db.databaseName} is initialized`)
  },
  botHandler: app
}

function createReportMessage({moonDay}) {
  if (!moonDay) return 'Не могу рассчитать лунный день. Странная астрологическая обстановка. Учти это'

  const {dayNumber, dayStart, dayEnd} = moonDay;
  let reportMessage =
    `Текущий лунный день: *${dayNumber}*
День начался: _${moment(dayStart).format('ddd D MMM HH:mm:ss')}_
День завершится: _${moment(dayEnd).format('ddd D MMM HH:mm:ss')}_
Начало следующего через: _${moment(dayEnd).fromNow()}_
`
  return reportMessage
}

async function saveCoordinatesToChatsCollection(ctx, coordinates) {
  const [lat, lng] = coordinates
  const chatsCollection = ctx.db.collection('chats')
  return chatsCollection.updateOne(
    {chatId: ctx.message.chat.id},
    {$set: {chatId: ctx.message.chat.id, coordinates: [lat, lng]}},
    {upsert: true}
  );
}
