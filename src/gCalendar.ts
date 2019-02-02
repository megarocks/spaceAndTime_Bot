import * as dotEnv from 'dotenv'
dotEnv.config()

import { calendar_v3, google } from 'googleapis'
import Schema$Event = calendar_v3.Schema$Event
import { get } from 'lodash/fp'
import { DateTime } from 'luxon'
import Params$Resource$Events$List = calendar_v3.Params$Resource$Events$List

async function main() {
  const startDateTime = DateTime.utc().startOf('day')
  const finishDateTime = DateTime.utc().endOf('day')
  const events = await getEvents(process.env.GOOGLE_ECO_CALENDAR_ID as string, startDateTime, finishDateTime)
  console.log(events)
}

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
    const eventsResponse = await await calendarApi.events.list(eventsRequestParams)

    return get('data.items', eventsResponse) || []
  } catch (error) {
    console.error(error)
    return []
  }
}

main()
  .then(() => {
    console.log('main finished')
    process.exit()
  })
  .catch(err => {
    console.log(err)
    process.exit(1)
  })
