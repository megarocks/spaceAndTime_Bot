const moment = require('moment');

const moonCalc = require('./moonCalc');

module.exports = ({ reply, replyWithMarkdown, replyWithHTML }) => {
  const {latitude:lat = 49.9935, longitude:lon = 36.2304 } = {};
  const currentMoonDay = moonCalc.calculateMoonDayFor(moment(), {lat, lon});

  if (!currentMoonDay) return reply('Can not calculate current moon date. Unusual astrologic situation')

  let replyMessage = `Current moon day is: <b>${currentMoonDay.dayNumber}</b>\n`
  replyMessage += `Started at: <i>${moment(currentMoonDay.dayStart).format('ddd D MMM HH:mm:ss')}</i>\n`
  replyMessage += `Last up to: <i>${moment(currentMoonDay.dayEnd).format('ddd D MMM HH:mm:ss')}</i>\n`
  replyMessage += `Next day start in ${moment(currentMoonDay.dayEnd).fromNow()}\n`
  replyMessage += `calculation are done for location: lat: ${lat}, lon: ${lon}`
  return replyWithHTML(replyMessage)
}