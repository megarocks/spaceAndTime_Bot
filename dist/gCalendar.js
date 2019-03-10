"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotEnv = __importStar(require("dotenv"));
dotEnv.config();
const debug_1 = __importDefault(require("debug"));
const googleapis_1 = require("googleapis");
const fp_1 = require("lodash/fp");
const debug = debug_1.default(`astral_bot:google-calendar`);
function getEvents(calendarId, startDateTime, finishDateTime) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
            oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
            const calendarApi = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
            const eventsRequestParams = {
                calendarId,
                timeMin: startDateTime.toISO(),
                timeMax: finishDateTime.toISO(),
                timeZone: 'UTC',
            };
            debug('getting event with params: %O', eventsRequestParams);
            const eventsResponse = yield calendarApi.events.list(eventsRequestParams);
            debug('got eventsResponse from google API');
            const events = fp_1.get('data.items', eventsResponse) || [];
            debug(`%d events are fetched: %O`, events.length, events);
            return events;
        }
        catch (error) {
            debug(error);
            return [];
        }
    });
}
exports.getEvents = getEvents;
