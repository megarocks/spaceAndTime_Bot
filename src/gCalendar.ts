import * as dotEnv from 'dotenv'
dotEnv.config()

import createDebugger from 'debug'
import { calendar_v3, google } from 'googleapis'
import { get } from 'lodash/fp'
import { DateTime } from 'luxon'
import Params$Resource$Events$List = calendar_v3.Params$Resource$Events$List
import Schema$Event = calendar_v3.Schema$Event

const debug = createDebugger(`astral_bot:google-calendar`)

// async function main() {
//   const startDateTime = DateTime.utc().startOf('day')
//   const finishDateTime = DateTime.utc().endOf('day')
//   return getEvents(process.env.GOOGLE_ECO_CALENDAR_ID as string, startDateTime, finishDateTime)
// }

export async function getEvents(calendarId: string, startDateTime: DateTime, finishDateTime: DateTime): Promise<Schema$Event[]> {
  try {
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN })

    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })

    const eventsRequestParams: Params$Resource$Events$List = {
      calendarId,
      timeMin: startDateTime.toISO(),
      timeMax: finishDateTime.toISO(),
      timeZone: 'UTC',
    }

    debug('getting event with params: %O', eventsRequestParams)
    const eventsResponse = await calendarApi.events.list(eventsRequestParams)
    debug('got eventsResponse from google API')

    const events = get('data.items', eventsResponse) || []
    debug(`%d events are fetched: %O`, events.length, events)

    return events
  } catch (error) {
    debug(error)
    return []
  }
}

// main()
//   .then(() => {
//     debug('main finished')
//     process.exit()
//   })
//   .catch(err => {
//     debug('error')
//     debug(err)
//     process.exit(1)
//   })
