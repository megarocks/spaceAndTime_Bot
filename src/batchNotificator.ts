import * as dotEnv from 'dotenv'
dotEnv.config()

import geoTz from 'geo-tz'
import { DateTime } from 'luxon'
import { Db, MongoClient } from 'mongodb'
import request from 'request-promise-native'
import SunCalc from 'suncalc'
import createDebugger from 'debug'

import { IChat, IMoonDay, INotificationResult } from './interfaces'
import { calculateMoonDayFor } from './moonCalc'
import { createCalendarMessage, createMoonMessage, createSolarMessage, getDayDurationDifference } from './utils'
import { getEvents } from './gCalendar'

const debug = createDebugger(`astral_bot:notificator`)

const mongoUri = process.env.MONGODB_URI || ''
let db: Db

async function main() {
  try {
    const mongoClient: MongoClient = await MongoClient.connect(
      mongoUri,
      { useNewUrlParser: true }
    )
    db = mongoClient.db()
    debug('database connected: ', mongoUri)

    const chatsCollection = db.collection('chats')
    const chats: IChat[] = await chatsCollection.find({}).toArray()
    debug('%d chats are fetched from collection', chats.length)

    const notificationJobs: Array<() => Promise<INotificationResult | undefined>> = chats.map(chat => createNotificationJob(chat))
    debug('%d notification jobs are scheduled', notificationJobs.length)

    const notificationResults: Array<INotificationResult | undefined> = await Promise.all(notificationJobs.map(notificationJob => notificationJob()))
    debug('%d notification jobs are performed', notificationResults.length)

    const successfulNotificationResults: INotificationResult[] = notificationResults.filter(sr => !!sr) as INotificationResult[]
    debug('%d SUCCESSFUL notification results', successfulNotificationResults.length)
    if (!successfulNotificationResults.length) {
      return
    }

    const resultsSavingJobs = successfulNotificationResults.map(createDbSavingJob)
    debug('%d resultsSavingJobs are scheduled', resultsSavingJobs.length)
    if (!resultsSavingJobs.length) {
      return
    }

    await Promise.all(resultsSavingJobs)
    debug('notification results are saved into DB')
  } catch (e) {
    debug('Error while performing batch sending')
    debug(e)
  }
}

function createNotificationJob(chat: IChat) {
  return async (): Promise<INotificationResult | undefined> => {
    try {
      debug('creating notification job for chat: %O', chat)
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
      debug('solar related message: ', solarRelatedMessage)

      // moon message
      const moonDay = calculateMoonDayFor(calculationDate, { lng, lat })
      const moonRelatedMessage = getMoonNewsMessage({
        chat,
        moonDay,
        timeZone,
      })
      messagesArray.push(moonRelatedMessage)
      debug('moon Related Message: ', moonRelatedMessage)

      // google calendar message
      const calendarMessages = await getCalendarNewsMessage({ chat, calculationDate })
      messagesArray.push(calendarMessages)
      debug('calendar messages: ', calendarMessages)

      // final message
      const meaningFullMessages = messagesArray.filter(m => m)
      if (meaningFullMessages.length < 2) {
        debug('no news to send to the chat; returning undefined from createNotificationJob')
        return
      } // if no messages or only common message - no sense to send
      const reportMessage = meaningFullMessages.join('\n')
      debug('final message: ', reportMessage)

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

      debug('going to send notification with request options: %O', requestOptions)
      const response = await request(requestOptions)

      // send results
      if (!response.ok) {
        throw new Error(response.description)
      }

      const notificationResult: INotificationResult = {
        chatId,
      }

      if (solarRelatedMessage || calendarMessages) {
        notificationResult.solarDateNotified = calculationDate.toJSDate()
      }
      if (moonDay && moonRelatedMessage) {
        notificationResult.moonDayNotified = moonDay.dayNumber
      }

      return notificationResult
    } catch (e) {
      debug('Error while sending message')
      debug(e.message)
    }
  }
}

function getMoonNewsMessage(options: { moonDay: IMoonDay | undefined; chat: IChat; timeZone: string }): string | undefined {
  const { moonDay, chat, timeZone } = options
  if (!moonDay) {
    console.warn(`Moon day was not calculated for: ${chat.chatId} at ${new Date().toISOString()}`)
    return
  }
  if (chat.moonDayNotified === moonDay.dayNumber) {
    debug('chat %s is already notified about moon day: %d', chat.chatId, moonDay.dayNumber)
    return
  } // means already notified
  return createMoonMessage({ moonDay, timeZone })
}

function getSolarNewsMessage(options: { chat: IChat; calculationDate: DateTime; timeZone: string }): string | undefined {
  const {
    chat: {
      chatId,
      location: {
        coordinates: [lng, lat],
      },
      solarDateNotified,
    },
    calculationDate,
    timeZone,
  } = options

  if (solarDateNotified && calculationDate.hasSame(DateTime.fromJSDate(solarDateNotified), 'day')) {
    debug('skipping to notify chat %s; it is already notified about solar day: %s', chatId, solarDateNotified.toISOString())
    return
  }

  const sunTimesToday = SunCalc.getTimes(calculationDate.toJSDate(), lat, lng)
  const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
  const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)

  if (calculationDate < sunRiseToday) {
    debug('skipping to notify chat %s about solar day: %s because to early', chatId, calculationDate.toISO())
    return
  } // sunrise should be already there

  const sunTimesYesterday = SunCalc.getTimes(calculationDate.minus({ days: 1 }).toJSDate(), lat, lng)

  const dayDurationDiff = getDayDurationDifference(sunTimesToday, sunTimesYesterday)

  return createSolarMessage({
    dayDurationDiff,
    sunRiseToday,
    sunSetToday,
    timeZone,
  })
}

async function getCalendarNewsMessage(options: { chat: IChat; calculationDate: DateTime }): Promise<string | undefined> {
  const { chat, calculationDate } = options
  if (chat.solarDateNotified && calculationDate.hasSame(DateTime.fromJSDate(chat.solarDateNotified), 'day')) {
    debug('skipping to notify chat %s about calendar day %s because it is already notified', chat.chatId, calculationDate.toISO())
    return
  }

  const sunTimesToday = SunCalc.getTimes(calculationDate.toJSDate(), chat.location.coordinates[1], chat.location.coordinates[0])
  const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)

  if (calculationDate < sunRiseToday) {
    debug('skipping to notify chat %s about calendar day: %s because to early', chat.chatId, calculationDate.toISO())
    return
  } // sunrise should be already there

  const calendarEventsStartDateTime = calculationDate.startOf('day')
  const calendarEventsFinishDateTime = calculationDate.endOf('day')

  const calendarEvents = await getEvents(process.env.GOOGLE_ECO_CALENDAR_ID as string, calendarEventsStartDateTime, calendarEventsFinishDateTime)

  const calendarMessages = calendarEvents.reduce((accumulatedString, event, index, allEvents) => {
    let messageForCurrentEvent = createCalendarMessage(event)
    if (index < allEvents.length - 1) {
      messageForCurrentEvent += '\n\n'
    }
    return (accumulatedString += messageForCurrentEvent)
  }, '')

  return calendarMessages
}

async function createDbSavingJob(data: INotificationResult) {
  try {
    debug('creating saving job with data: %O', data)
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
  debug('main finished')
  process.exit()
})
