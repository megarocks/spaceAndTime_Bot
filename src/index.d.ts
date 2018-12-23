import { ContextMessageUpdate } from 'telegraf';
import {Db} from 'mongodb'
import {DateTime} from "luxon"

export interface ContextMessageUpdateWithDb extends ContextMessageUpdate {
  db: Db,
  location?: {
    latitude: number,
    longitude: number
  }
}

export interface MoonDay {
  dayNumber: number,
  dayStart: DateTime,
  dayEnd: DateTime
}

export interface Chat {
  chatId: number,
  location: {
    type: string,
    coordinates: [number, number]
  },
  moonDayNotified?: number,
  solarDateNotified?: Date
}

export interface NotificationResult {
  chatId: number,
  moonDayNotified?: number,
  solarDateNotified?: Date
}