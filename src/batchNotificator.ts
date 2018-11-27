require('dotenv').config({debug: true})

import {MongoClient} from 'mongodb'
import {DateTime} from 'luxon';

import {calculateMoonDayFor} from './moonCalc';

interface Chat {
    chatId: number,
    location: {
        type: string,
        coordinates: [number, number]
    }
}

const mongoUri = process.env.MONGODB_URI || '';

async function main() {
    try {
        const mongoClient = await MongoClient.connect(mongoUri, {useNewUrlParser: true});
        const db = mongoClient.db();
        const chatsCollection = db.collection('chats');
        const chats: Chat[] = await chatsCollection.find({}).toArray();
        const messageSendingJobs = chats.map(sendingJob);
        return Promise.all(messageSendingJobs);
    } catch (e) {
        console.error('Error while performing batch sending');
        console.error(e);
    }
}

async function sendingJob(chat: Chat): Promise<any> {
    try {
        const {chatId, location: {coordinates = []} = {}} = chat;
        const moonDay = calculateMoonDayFor(DateTime.utc().toJSDate(), {
            lng: coordinates[0],
            lat: coordinates[1]
        })
        console.log({chatId, moonDay: moonDay.dayNumber})
    } catch (e) {
        console.log('Error while sending message')
        console.error(e)
    }
}

main().then(() => {
    console.log('\nmain finished')
    process.exit()
})
