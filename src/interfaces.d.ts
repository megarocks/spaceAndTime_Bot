import { DateTime } from 'luxon'
import { Db } from 'mongodb'
import { ContextMessageUpdate } from 'telegraf'

export interface IContextMessageUpdateWithDb extends ContextMessageUpdate {
  db: Db
}

export interface IMoonDay {
  dayNumber: number
  dayStart: DateTime
  dayEnd: DateTime
}

export interface IMoonPhase {
  symbol: string
  label: string
}

export interface IChat {
  chatId: number
  location: {
    type: string
    coordinates: [number, number]
  }
  moonDayNotified?: number
  solarDateNotified?: Date,
  calendarDateNotified?: Date
}

export interface INotificationResult {
  chatId: number
  moonDayNotified?: number
  solarDateNotified?: Date
  calendarDateNotified?: Date
}
