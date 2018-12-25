import * as dotEnv from 'dotenv'
dotEnv.config()

import googleMaps from '@google/maps'
import geoTz from 'geo-tz'
import { DateTime } from 'luxon'
import { Composer } from 'micro-bot'
import { Db, MongoClient } from 'mongodb'
import Extra from 'telegraf/extra'
import Markup from 'telegraf/markup'
import Scene from 'telegraf/scenes/base'
import session from 'telegraf/session'
import Stage from 'telegraf/stage'

import { IContextMessageUpdateWithDb } from './interfaces'
import * as moonCalc from './moonCalc'
import { createHelpMessage, createMoonMessage, createStartMessage } from './utils'

const { enter, leave } = Stage

const googleMapsClient = googleMaps.createClient({
  Promise: Promise,
})

const sendLocationKeyboard = Extra.markup((markup: any) =>
  markup
    .keyboard([markup.locationRequestButton('📍 Оправить координаты!')])
    .oneTime()
    .resize()
)
const removeKb = Markup.removeKeyboard().extra()

const app = new Composer()
app.use(session())

const setLocationScene = new Scene('location')
setLocationScene.enter(async (ctx: IContextMessageUpdateWithDb) => {
  return ctx.reply('Напиши где ты находишься, или пришли мне свои координаты и я рассчитаю для тебя астрологическую обстановку.\n', sendLocationKeyboard)
})
setLocationScene.on('location', async (ctx: IContextMessageUpdateWithDb) => {
  try {
    const { message: { chat: { id: chatId = null } = {}, location: { latitude: lat = null, longitude: lng = null } = {} } = {} } = ctx

    if (!chatId) {
      throw new Error(`chat id is not defined`)
    }

    if (!lat || !lng) {
      return ctx.reply('Не могу определить координаты. Проверь службы геолокации')
    }

    await saveCoordinatesToChatsCollection(ctx.db, chatId, { lat, lng })
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lng}\nШирота: ${lat}\n`)

    const [timeZone] = geoTz(lat, lng)
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc(), { lat, lng })
    if (!moonDay) {
      return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`)
    }
    const reportMessage = createMoonMessage({ moonDay, timeZone })
    await ctx.replyWithMarkdown(reportMessage, removeKb)
  } catch (err) {
    console.error(err)
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
  } finally {
    leave()
  }
})
setLocationScene.on('text', async (ctx: IContextMessageUpdateWithDb) => {
  try {
    const { chat: { id: chatId = null } = {}, message: { text = '' } = {} } = ctx

    if (!chatId) {
      throw new Error(`chat id is not defined`)
    }

    const geoCodingResponse = await googleMapsClient.geocode({ address: text }).asPromise()
    if (!geoCodingResponse.json.results.length) {
      return ctx.reply(`Не удалось определить координаты: ${text}.` + `Попробуй ввести официальное название ближайшего населённого пункта`)
    }

    const {
      json: {
        results: [
          {
            geometry: {
              location: { lat, lng },
            },
          },
        ],
      },
    } = geoCodingResponse

    await saveCoordinatesToChatsCollection(ctx.db, chatId, { lat, lng })
    await ctx.reply(`Благодарю. Запомнил координаты:\nДолгота: ${lat}\nШирота: ${lng}\n`)

    const [timeZone] = geoTz(lat, lng)
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc(), { lat, lng })
    if (!moonDay) {
      return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`)
    }
    const reportMessage = createMoonMessage({ moonDay, timeZone })
    await ctx.replyWithMarkdown(reportMessage, removeKb)
  } catch (e) {
    console.error(e)
    await ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу', removeKb)
  } finally {
    leave()
  }
})

const stage = new Stage([setLocationScene], { ttl: 10 })
app.use(stage.middleware())

app.start(async (ctx: IContextMessageUpdateWithDb) => {
  await ctx.reply(createStartMessage())
})
app.help(async (ctx: IContextMessageUpdateWithDb) => {
  await ctx.reply(createHelpMessage())
})

app.command('location', enter('location'))
app.command('day', async (ctx: IContextMessageUpdateWithDb) => {
  try {
    const { message: { chat: { id: chatId = null } = {} } = {} } = ctx
    const chat = await ctx.db.collection('chats').findOne({ chatId })
    if (!chat) {
      return ctx.reply('Используйте команду /location чтобы задать своё местоположение')
    }

    const {
      location: {
        coordinates: [lng, lat],
      },
    } = chat
    const [timeZone] = geoTz(lat, lng)
    const moonDay = moonCalc.calculateMoonDayFor(DateTime.utc(), { lat, lng })
    if (!moonDay) {
      return ctx.reply(`По какой-то причине не могу произвести рассчет. Попробуй спросить меня позже`)
    }
    const reportMessage = createMoonMessage({ moonDay, timeZone })
    return ctx.replyWithMarkdown(reportMessage)
  } catch (err) {
    console.error(err)
    ctx.reply('Сорян. Во время вычислений произошла ошибка. Сообщи об этом Веталу')
  }
})

module.exports = {
  botHandler: app,
  initialize: async (botApp: any) => {
    const mongoUri = process.env.MONGODB_URI || ''
    const mongoClient: MongoClient = await MongoClient.connect(
      mongoUri,
      { useNewUrlParser: true }
    )
    botApp.context.db = mongoClient.db()
    console.log(`DB ${botApp.context.db.databaseName} is initialized`)
  },
}

async function saveCoordinatesToChatsCollection(db: Db, chatId: number, coordinates: { lat: number; lng: number }) {
  const { lng, lat } = coordinates
  const chatsCollection = db.collection('chats')
  return chatsCollection.updateOne(
    { chatId },
    {
      $set: {
        chatId,
        location: { type: 'Point', coordinates: [lng, lat] },
      },
    },
    { upsert: true }
  )
}
