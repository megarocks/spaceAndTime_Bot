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
        const calculationDate = DateTime.utc().toJSDate()

        //moon message
        const moonDay = calculateMoonDayFor(calculationDate, {lng, lat});
        const moonRelatedMessage = getMoonRelatedMessage({
            moonDay,
            chat,
            timeZone,
        });
        messagesArray.push(moonRelatedMessage);

        //solar message
        const solarRelatedMessage = getSolarRelatedMessage({calculationDate, chat, timeZone})
        messagesArray.push(solarRelatedMessage);

        //final message
        const meaningFullMessages = messagesArray.filter(m => m);
        if (!meaningFullMessages.length) return;
        console.log(meaningFullMessages)
        const reportMessage = meaningFullMessages.join ('\n');

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
        const {dayNumber: moonDayNumber = undefined} = moonDay || {};
        return {chatId, moonDayNumber, solarDate: calculationDate}
    } catch (e) {
        console.log('Error while sending message')
        console.error(e.message)
    }
}

function getMoonRelatedMessage(options: { moonDay: MoonDay | undefined, chat: Chat, timeZone: string }): string | undefined {
    const {moonDay, chat, timeZone} = options
    if (!moonDay) {
        console.warn(`Moon day was not calculated for: ${chat.chatId} at ${new Date().toISOString()}`)
        return
    }
    if (chat.moonDayNotified === moonDay.dayNumber) return;  // means already notified
    return createReportMessage({moonDay, timeZone});
}

function getSolarRelatedMessage(options: { chat: Chat, calculationDate: Date, timeZone: string }): string | undefined {
    const {chat, calculationDate, timeZone} = options
    const testDate = DateTime.utc(2019, 3, 20, 15)

    const sunTimesToday = SunCalc.getTimes(testDate.toJSDate(), chat.location.coordinates[1], chat.location.coordinates[0]);
    const sunRiseToday = DateTime.fromJSDate(sunTimesToday.sunrise)
    const sunSetToday = DateTime.fromJSDate(sunTimesToday.sunset)
    const dayLength = sunSetToday.diff(sunRiseToday, ['hours', 'minutes'])

    const sunTimesYesterday = SunCalc.getTimes(testDate.minus({days: 1}).toJSDate(), chat.location.coordinates[1], chat.location.coordinates[0]);
    const sunSetYtd = DateTime.fromJSDate(sunTimesYesterday.sunset)
    const nightLength = sunRiseToday.diff(sunSetYtd, ['hours', 'minutes'])

    const totalPcntValue = nightLength.as('milliseconds') + dayLength.as('milliseconds');
    const dayPcnt = (dayLength.as('milliseconds') / totalPcntValue) * 100;
    const nightPcnt = (nightLength.as('milliseconds') / totalPcntValue) * 100;


    console.log({
        calculationDate: testDate.setZone(timeZone).toISO(),
        rise: sunRiseToday.setZone(timeZone).toISO(),
        set: sunSetToday.setZone(timeZone).toISO(),
        dayLength: dayLength.toObject(),
        nightLength: nightLength.toObject(),
        dayPcnt, nightPcnt
    })
    return `Солнечная дата: ${testDate.setZone(timeZone).toLocaleString()}
восход: ${sunRiseToday.setZone(timeZone).toLocaleString()}
закат: ${sunSetToday.setZone(timeZone).toLocaleString()}
дня: ${dayLength.hours} ${ getNoun(dayLength.hours, 'час', 'часа', 'часов' )} ${Math.floor(dayLength.minutes)} ${ getNoun(Math.floor(dayLength.minutes), 'минута', 'минуты', 'минут' )}
ночи: ${nightLength.hours} ${ getNoun(nightLength.hours, 'час', 'часа', 'часов' )} ${Math.floor(nightLength.minutes)} ${ getNoun(Math.floor(nightLength.minutes), 'минута', 'минуты', 'минут' )}
`
}

async function databaseSavingJob(data: NotificationResult) {
    try {
        return db
            .collection('chats')
            .updateOne({chatId: data.chatId}, {$set: {moonDayNotified: data.moonDayNumber}})
    } catch (e) {
        console.log(JSON.stringify(data) + ' failed to save to DB');
        console.error(e);
    }
}

main().then(() => {
    console.log('\nmain finished')
    process.exit()
})
