require('dot-env');
const moment = require('moment');
const {Composer} = require('micro-bot');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const MongoClient = require('mongodb').MongoClient; //123

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
  'Пришли мне свою локацию и я скажу тебе какой в этой точке пространства сейчас лунный день', sendLocationKeyboard
  )
);
app.command('location', async ctx => {
  return ctx.reply('Пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку', sendLocationKeyboard)
})

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

app.on('location', async ctx => {
  try {
    const {message: {location: {latitude, longitude}}} = ctx
    const chatsCollection = ctx.db.collection('chats')

    if (!latitude || !longitude) return ctx.reply('Не могу определить координаты. Проверь службы геолокации')

    await chatsCollection.updateOne(
      {chatId: ctx.message.chat.id},
      {$set: {chatId: ctx.message.chat.id, coordinates: [latitude, longitude]}},
      {upsert: true}
    )

    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${longitude}\nШирота: ${latitude}\n`)

    const moonDay = moonCalc.calculateMoonDayFor(moment(), {lat:latitude, lon: longitude});
    const reportMessage = createReportMessage({moonDay})
    return ctx.replyWithMarkdown(reportMessage, removeKb)
  } catch (err) {
    console.error(err)
    ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
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
