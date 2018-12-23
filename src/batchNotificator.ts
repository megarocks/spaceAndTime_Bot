require('dotenv').config();

import {MongoClient} from 'mongodb';
import {DateTime} from 'luxon';
import geoTz from 'geo-tz';
import request from 'request-promise-native';
import SunCalc from "suncalc";

import {calculateMoonDayFor} from './moonCalc';
import {Chat, NotificationResult, MoonDay, createReportMessage, getNoun} from './utils'

const mongoUri = process.env.MONGODB_URI || '';
let db;

async function main() {
  try {
    const mongoClient = await MongoClient.connect(mongoUri, {useNewUrlParser: true});
    db = mongoClient.db();
    const chatsCollection = db.collection('chats');
    const chats: Chat[] = await chatsCollection.find({}).toArray();
    const messageSendingJobs: Promise<NotificationResult>[] = chats.map(chat => sendingJob(chat));
    const sendingResults: NotificationResult[] = await Promise.all(messageSendingJobs);
    const successFullSendingResults: NotificationResult[] = sendingResults.filter(sr => !!sr);

    console.log(`${successFullSendingResults.length} notifications successfully sent`);

    const resultsSavingJobs = successFullSendingResults.map(databaseSavingJob);
    await Promise.all(resultsSavingJobs)
  } catch (e) {
    console.error('Error while performing batch sending');
    console.error(e);
  }
}

async function sendingJob(chat: Chat): Promise<NotificationResult | undefined> {
  try {
    const {chatId, location: {coordinates: [lng = null, lat = null] = []} = {}} = chat;
    if (!lat || !lng) throw new Error(`no coordinates for chat: ${chatId}`);
    const [timeZone] = geoTz(lat, lng);
    if (!timeZone) throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`);

    const messagesArray: Array<string | undefined> = [];
    const calculationDate = DateTime.utc()

    //common message
    let commonMessage = `⏰ Рассчетное время: ${calculationDate.setZone(timeZone).toLocaleString(DateTime.DATETIME_MED)}\n`
    commonMessage += `🌐 Временная зона: ${timeZone}\n`

    messagesArray.push(commonMessage)

    //moon message
    const moonDay = calculateMoonDayFor(calculationDate.toJSDate(), {lng, lat});
    const moonRelatedMessage = getMoonNewsMessage({
      moonDay,
      chat,
      timeZone,
    });
    messagesArray.push(moonRelatedMessage);

    //solar message
    const solarRelatedMessage = getSolarNewsMessage({calculationDate, chat, timeZone})
    messagesArray.push(solarRelatedMessage);

    //final message
    const meaningFullMessages = messagesArray.filter(m => m);
    if (meaningFullMessages.length < 2) return; // if no messages or only common message - no sense to send
    const reportMessage = meaningFullMessages.join('\n');

    //send request
    const requestOptions = {
      method: 'POST',
      uri: `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      json: true,
      body: {
        chat_id: chatId,
        text: reportMessage,
        parse_mode: 'Markdown'
      },
      simple: false
    };
    const response = await request(requestOptions);

    //send results
    if (!response.ok) throw new Error(response.description);
    const {dayNumber: moonDayNumber = null} = moonDay || {};

    let notificationResult: NotificationResult = {
      chatId
    }

    if (solarRelatedMessage) notificationResult.solarDateNotified = calculationDate.toJSDate()
    if (moonRelatedMessage) notificationResult.moonDayNumber = moonDayNumber

    return notificationResult
  } catch (e) {
    console.log('Error while sending message')
    console.error(e.message)
  }
}

function getMoonNewsMessage(options: { moonDay: MoonDay | undefined, chat: Chat, timeZone: string }): string | undefined {
  const {moonDay, chat, timeZone} = options
  if (!moonDay) {
    console.warn(`Moon day was not calculated for: ${chat.chatId} at ${new Date().toISOString()}`)
    return
  }
  if (chat.moonDayNotified === moonDay.dayNumber) return;  // means already notified
  return createReportMessage({moonDay, timeZone});
}

function getSolarNewsMessage(options: { chat: Chat, calculationDate: DateTime, timeZone: string }): string | undefined {
  const {chat: {location: {coordinates: [lng, lat]}, solarDateNotified}, calculationDate, timeZone} = options

  const chatSolarDateNotified = DateTime.fromJSDate(solarDateNotified)
  console.log({
    solarDateNotified,
    chatSolarDateNotified: chatSolarDateNotified.toLocaleString(),
    'sameDate': calculationDate.hasSame(chatSolarDateNotified, 'day')
  })
  if (calculationDate.hasSame(chatSolarDateNotified, 'day')) return; // calculation date should be other than solarDateNotified

  const sunTimesToday = SunCalc.getTimes(calculationDate.toJSDate(), lat, lng);
  const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
  const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)
  const dayLength = sunSetToday.diff(sunRiseToday, ['hours', 'minutes'])

  console.log({
    sunRiseToday: sunRiseToday.toISO(),
    calculationDate: calculationDate.toISO(),
    'lessThenSunRise': calculationDate < sunRiseToday
  })
  if (calculationDate < sunRiseToday) return // sunrise should be already there

  const sunTimesYesterday = SunCalc.getTimes(calculationDate.minus({days: 1}).toJSDate(), lat, lng);
  const sunSetYtd = DateTime.fromJSDate(sunTimesYesterday.sunset)
  const nightLength = sunRiseToday.diff(sunSetYtd, ['hours', 'minutes'])

  const [dayPercent, nightPercent] = getPercentRelation([
    dayLength.as('milliseconds'),
    nightLength.as('milliseconds')
  ])

  return `☀️ Солнце:
🌅 восход:\t ${sunRiseToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🌇 закат:\t ${sunSetToday.setZone(timeZone).toLocaleString(DateTime.TIME_24_SIMPLE)}
🏙️ дня:\t ${dayPercent.toFixed(1)} %
🌃 ночи:\t ${nightPercent.toFixed(1)} %`
}

function getPercentRelation(values: number[]): number[] {
  const hundredPercent = values.reduce((acc, val) => acc + val, 0)
  return values.map(value => value * 100 / hundredPercent)
}

async function databaseSavingJob(data: NotificationResult) {
  try {
    return db
      .collection('chats')
      .updateOne({chatId: data.chatId}, {
        $set: data
      })
  } catch (e) {
    console.log(JSON.stringify(data) + ' failed to save to DB');
    console.error(e);
  }
}

main().then(() => {
  console.log('\nmain finished')
  process.exit()
})
