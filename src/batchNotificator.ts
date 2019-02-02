import * as dotEnv from 'dotenv'
dotEnv.config()

import geoTz from 'geo-tz'
import { DateTime } from 'luxon'
import { Db, MongoClient } from 'mongodb'
import request from 'request-promise-native'
import SunCalc from 'suncalc'

import { IChat, IMoonDay, INotificationResult } from './interfaces'
import { calculateMoonDayFor } from './moonCalc'
import { createMoonMessage, createSolarMessage, getPercentRelation } from './utils'

const mongoUri = process.env.MONGODB_URI || ''
let db: Db

async function main() {
  try {
    const mongoClient: MongoClient = await MongoClient.connect(
      mongoUri,
      { useNewUrlParser: true }
    )
    db = mongoClient.db()
    const chatsCollection = db.collection('chats')
    const chats: IChat[] = await chatsCollection.find({}).toArray()
    const notificationJobs: Array<Promise<INotificationResult | undefined>> = chats.map(createNotificationJob)
    const notificationResults: Array<INotificationResult | undefined> = await Promise.all(notificationJobs)
    const successfulNotificationResults: INotificationResult[] = notificationResults.filter(sr => !!sr) as INotificationResult[]

    console.log(`${successfulNotificationResults.length} notifications successfully sent`)

    const resultsSavingJobs = successfulNotificationResults.map(createDbSavingJob)
    await Promise.all(resultsSavingJobs)
  } catch (e) {
    console.error('Error while performing batch sending')
    console.error(e)
  }
}

async function createNotificationJob(chat: IChat): Promise<INotificationResult | undefined> {
  try {
    const { chatId, location: { coordinates: [lng = null, lat = null] = [] } = {} } = chat
    if (!lat || !lng) {
      throw new Error(`no coordinates for chat: ${chatId}`)
    }
    const [timeZone] = geoTz(lat, lng)
    if (!timeZone) {
      throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`)
    }

    const messagesArray: Array<string | undefined> = []
    const calculationDate = DateTime.utc()

    // common message
    let commonMessage = `⏰ время: ${calculationDate
      .setZone(timeZone)
      .setLocale('ru')
      .toLocaleString(DateTime.DATETIME_SHORT)}\n`
    commonMessage += `🌐 часовой пояс: ${timeZone}\n`

    messagesArray.push(commonMessage)

    // solar message
    const solarRelatedMessage = getSolarNewsMessage({
      calculationDate,
      chat,
      timeZone,
    })
    messagesArray.push(solarRelatedMessage)

    // moon message
    const moonDay = calculateMoonDayFor(calculationDate, { lng, lat })
    const moonRelatedMessage = getMoonNewsMessage({
      chat,
      moonDay,
      timeZone,
    })
    messagesArray.push(moonRelatedMessage)

    // final message
    const meaningFullMessages = messagesArray.filter(m => m)
    if (meaningFullMessages.length < 2) {
      return
    } // if no messages or only common message - no sense to send
    const reportMessage = meaningFullMessages.join('\n')

    const recipientTime = calculationDate.setZone(timeZone)
    // send request
    const requestOptions = {
      body: {
        chat_id: chatId,
        disable_notification: recipientTime.hour < 8 || recipientTime.hour > 21,
        parse_mode: 'Markdown',
        text: reportMessage,
      },
      json: true,
      method: 'POST',
      simple: false,
      uri: `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    }
    const response = await request(requestOptions)

    // send results
    if (!response.ok) {
      throw new Error(response.description)
    }

    const notificationResult: INotificationResult = {
      chatId,
    }

    if (solarRelatedMessage) {
      notificationResult.solarDateNotified = calculationDate.toJSDate()
    }
    if (moonDay && moonRelatedMessage) {
      notificationResult.moonDayNotified = moonDay.dayNumber
    }

    return notificationResult
  } catch (e) {
    console.log('Error while sending message')
    console.error(e.message)
  }
}

function getMoonNewsMessage(options: { moonDay: IMoonDay | undefined; chat: IChat; timeZone: string }): string | undefined {
  const { moonDay, chat, timeZone } = options
  if (!moonDay) {
    console.warn(`Moon day was not calculated for: ${chat.chatId} at ${new Date().toISOString()}`)
    return
  }
  if (chat.moonDayNotified === moonDay.dayNumber) {
    return
  } // means already notified
  return createMoonMessage({ moonDay, timeZone })
}

function getSolarNewsMessage(options: { chat: IChat; calculationDate: DateTime; timeZone: string }): string | undefined {
  const {
    chat: {
      location: {
        coordinates: [lng, lat],
      },
      solarDateNotified,
    },
    calculationDate,
    timeZone,
  } = options

  if (solarDateNotified && calculationDate.hasSame(DateTime.fromJSDate(solarDateNotified), 'day')) {
    return
  }

  const sunTimesToday = SunCalc.getTimes(calculationDate.toJSDate(), lat, lng)
  const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
  const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)
  const dayLength = sunSetToday.diff(sunRiseToday, ['hours', 'minutes'])

  if (calculationDate < sunRiseToday) {
    return
  } // sunrise should be already there

  const sunTimesYesterday = SunCalc.getTimes(calculationDate.minus({ days: 1 }).toJSDate(), lat, lng)
  const sunSetYtd = DateTime.fromJSDate(sunTimesYesterday.sunset)
  const nightLength = sunRiseToday.diff(sunSetYtd, ['hours', 'minutes'])

  const [dayPercent, nightPercent] = getPercentRelation([dayLength.as('milliseconds'), nightLength.as('milliseconds')])

  return createSolarMessage({
    dayPercent,
    nightPercent,
    sunRiseToday,
    sunSetToday,
    timeZone,
  })
}

async function createDbSavingJob(data: INotificationResult) {
  try {
    return db.collection('chats').updateOne(
      { chatId: data.chatId },
      {
        $set: data,
      }
    )
  } catch (e) {
    console.log(JSON.stringify(data) + ' failed to save to DB')
    console.error(e)
  }
}

main().then(() => {
  console.log('main finished')
  process.exit()
})
