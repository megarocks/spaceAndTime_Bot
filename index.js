require('dot-env');
const moment = require('moment');
const {Composer} = require('micro-bot');
const Telegraf = require('telegraf')
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const geoTz = require('geo-tz')

const moonCalc = require('./moonCalc');

const app = new Composer();


const sendLocationKeyboard = Extra.markup(markup => markup.keyboard([markup.locationRequestButton('📍 Оправить координаты!')]).oneTime().resize())
const removeKb = Markup.removeKeyboard().extra()

app.use(Telegraf.log())

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

app.on('location', async ctx => {
  const { message: { location: { latitude, longitude } } } = ctx
  return ctx.reply(`Благодарю. Координаты: ${JSON.stringify({ latitude, longitude })} приняты и сохранены. Буду держать тебя в курсе`, removeKb)
})

// {
//   reply_markup: {
//     keyboard: [[{request_location: true, text: 'Отправить координаты'}]],
//       one_time_keyboard: true,
//       resize_keyboard: true
//   }
// }

module.exports = app

// module.exports = ({ reply, replyWithMarkdown, replyWithHTML }) => {
//   const {latitude:lat = 49.9935, longitude:lon = 36.2304 } = {};
//   const currentMoonDay = moonCalc.calculateMoonDayFor(moment(), {lat, lon});
//
//   if (!currentMoonDay) return reply('Can not calculate current moon date. Unusual astrologic situation')
//
//   let replyMessage = `Current moon day is: <b>${currentMoonDay.dayNumber}</b>\n`
//   replyMessage += `Started at: <i>${moment(currentMoonDay.dayStart).format('ddd D MMM HH:mm:ss')}</i>\n`
//   replyMessage += `Last up to: <i>${moment(currentMoonDay.dayEnd).format('ddd D MMM HH:mm:ss')}</i>\n`
//   replyMessage += `Next day start in ${moment(currentMoonDay.dayEnd).fromNow()}\n`
//   replyMessage += `calculation are done for location: lat: ${lat}, lon: ${lon}`
//   return replyWithHTML(replyMessage)
// }