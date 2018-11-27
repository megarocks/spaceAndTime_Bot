require('dotenv').config();

import {MongoClient} from 'mongodb';
import {DateTime} from 'luxon';
import geoTz from 'geo-tz';
import request from 'request-promise-native';

import {calculateMoonDayFor} from './moonCalc';
import {Chat, NotificationResult, createReportMessage} from './utils'

const mongoUri = process.env.MONGODB_URI || '';
let db;

async function main() {
    try {
        const mongoClient = await MongoClient.connect(mongoUri, {useNewUrlParser: true});
        db = mongoClient.db();
        const chatsCollection = db.collection('chats');
        const chats: Chat[] = await chatsCollection.find({}).toArray();
        const messageSendingJobs: Promise<NotificationResult>[] = chats.map(sendingJob);
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
        const {chatId, location: {coordinates = []} = {}} = chat;
        if (!coordinates.length) throw new Error(`no coordinates for chat: ${chatId}`);

        const moonDay = calculateMoonDayFor(DateTime.utc().toJSDate(), {
            lng: coordinates[0],
            lat: coordinates[1]
        });
        if (!moonDay) throw new Error(`no newMoon day for chat: ${chatId}`);

        if (chat.moonDayNotified === moonDay.dayNumber) return;  // means already notified

        const {location: {coordinates: [lng, lat]}} = chat;
        const [timeZone] = geoTz(lat, lng);
        if (!timeZone) throw new Error(`no timezone for chat: ${chatId} and coordinates: ${lat} ${lng}`);

        const reportMessage = createReportMessage({moonDay, timeZone});

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

        if (!response.ok) throw new Error(response.description);

        return {chatId, moonDayNumber: moonDay.dayNumber}
    } catch (e) {
        console.log('Error while sending message')
        console.error(e.message)
    }
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
