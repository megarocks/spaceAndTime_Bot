"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const luxon_1 = require("luxon");
const moonCalc = __importStar(require("../moonCalc"));
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
});
const theoreticalNewMoons2019 = [
    luxon_1.DateTime.utc(2019, 1, 6, 1, 28),
    luxon_1.DateTime.utc(2019, 2, 4, 21, 3),
    luxon_1.DateTime.utc(2019, 3, 6, 16, 3),
    luxon_1.DateTime.utc(2019, 4, 5, 9, 50),
    luxon_1.DateTime.utc(2019, 5, 4, 23, 45),
    luxon_1.DateTime.utc(2019, 6, 3, 11, 1),
    luxon_1.DateTime.utc(2019, 7, 2, 20, 16),
    luxon_1.DateTime.utc(2019, 8, 1, 4, 11),
    luxon_1.DateTime.utc(2019, 8, 30, 11, 37),
    luxon_1.DateTime.utc(2019, 9, 28, 19, 26),
    luxon_1.DateTime.utc(2019, 10, 28, 3, 38),
    luxon_1.DateTime.utc(2019, 11, 26, 15, 5),
    luxon_1.DateTime.utc(2019, 12, 26, 5, 13),
];
const preCalculatedNewMoons2019 = [
    luxon_1.DateTime.utc(2019, 1, 5, 23, 28),
    luxon_1.DateTime.utc(2019, 2, 4, 19, 23),
    luxon_1.DateTime.utc(2019, 3, 6, 15, 34),
    luxon_1.DateTime.utc(2019, 4, 5, 10, 3),
    luxon_1.DateTime.utc(2019, 5, 5, 1, 3),
    luxon_1.DateTime.utc(2019, 6, 3, 12, 13),
    luxon_1.DateTime.utc(2019, 7, 2, 20, 32),
    luxon_1.DateTime.utc(2019, 8, 1, 3, 22),
    luxon_1.DateTime.utc(2019, 8, 30, 10, 0),
    luxon_1.DateTime.utc(2019, 9, 28, 17, 25),
    luxon_1.DateTime.utc(2019, 10, 28, 2, 19),
    luxon_1.DateTime.utc(2019, 11, 26, 13, 10),
    luxon_1.DateTime.utc(2019, 12, 26, 2, 13),
];
const coordinates = { lat: 52.3, lng: 4.9 };
test('it calculates practical PREV new moon day for middle of moon month with 180 minutes precision', () => {
    const diffsBetweenTheoryAndPractice = theoreticalNewMoons2019.map(theoreticalNewMoon => {
        const calculationDate = theoreticalNewMoon.plus({ days: 15 });
        const practicalNewMoon = moonCalc.getNewMoonDate({ startDate: calculationDate, isTravelingToPast: true });
        console.log(practicalNewMoon.toISO());
        return Math.abs(theoreticalNewMoon.diff(practicalNewMoon).as('minutes'));
    });
    expect(lodash_1.max(diffsBetweenTheoryAndPractice)).toBeLessThanOrEqual(180);
});
test('it calculates practical NEXT new moon day for middle of moon month with 180 minutes precision', () => {
    const diffsBetweenTheoryAndPractice = theoreticalNewMoons2019.map(theoreticalNewMoon => {
        const calculationDate = theoreticalNewMoon.minus({ days: 15 });
        const practicalNewMoon = moonCalc.getNewMoonDate({ startDate: calculationDate });
        return Math.abs(theoreticalNewMoon.diff(practicalNewMoon).as('minutes'));
    });
    expect(lodash_1.max(diffsBetweenTheoryAndPractice)).toBeLessThanOrEqual(180);
});
test('moon day calculation', () => {
    const moonDay = moonCalc.calculateMoonDayFor(preCalculatedNewMoons2019[7].plus({ days: 7 }), coordinates);
    expect(moonDay).toBeDefined();
});
test('moon day number calculation', () => {
    const moonDay = moonCalc.calculateMoonDayFor(preCalculatedNewMoons2019[7].plus({ days: 7 }), coordinates);
    const { dayNumber = null } = moonDay || {};
    expect(dayNumber).toBe(8);
});
test('moon months length', () => {
    const moonMothLengths = preCalculatedNewMoons2019.map((newMoon, idx) => {
        let prevNewMoon = newMoon;
        let nextNewMoon = preCalculatedNewMoons2019[idx + 1];
        if (idx === preCalculatedNewMoons2019.length - 1) {
            prevNewMoon = preCalculatedNewMoons2019[preCalculatedNewMoons2019.length - 2];
            nextNewMoon = newMoon;
        }
        const moonMoth = moonCalc.getMoonDaysBetweenNewMoons({ prevNewMoon, nextNewMoon, coordinates });
        return moonMoth.length;
    });
    const minMoonMonthLengths = lodash_1.min(moonMothLengths);
    const maxMoonMonthLengths = lodash_1.max(moonMothLengths);
    expect([minMoonMonthLengths, maxMoonMonthLengths].join(' ')).toBe('29 30');
});
describe('new moon', () => {
    const dateFormat = 'd MMM, y H:mm';
    describe('month edges', () => {
        const timeShift = { unit: 'minutes', value: 1 };
        describe('end of month', () => {
            describe('prev moon', () => {
                preCalculatedNewMoons2019.forEach((moon, idx) => {
                    let expectedPrevMoon = moon;
                    let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                    if (idx === preCalculatedNewMoons2019.length - 1) {
                        expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                        expectedNextMoon = moon;
                    }
                    test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                        const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                        const actualPrevMoon = moonCalc.getNewMoonDate({ startDate, isTravelingToPast: true });
                        expect(actualPrevMoon.toFormat(dateFormat)).toBe(expectedPrevMoon.toFormat(dateFormat));
                    });
                });
            });
            describe('next moon', () => {
                preCalculatedNewMoons2019.forEach((moon, idx) => {
                    let expectedPrevMoon = moon;
                    let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                    if (idx === preCalculatedNewMoons2019.length - 1) {
                        expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                        expectedNextMoon = moon;
                    }
                    test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                        const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                        const actualNextMoon = moonCalc.getNewMoonDate({ startDate });
                        expect(actualNextMoon.toFormat(dateFormat)).toBe(expectedNextMoon.toFormat(dateFormat));
                    });
                });
            });
        });
        describe('beginning of month', () => {
            describe('prev moon', () => {
                preCalculatedNewMoons2019.forEach((moon, idx) => {
                    let expectedPrevMoon = moon;
                    let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                    if (idx === preCalculatedNewMoons2019.length - 1) {
                        expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                        expectedNextMoon = moon;
                    }
                    test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                        const startDate = expectedPrevMoon.plus({ [timeShift.unit]: timeShift.value });
                        const actualPrevMoon = moonCalc.getNewMoonDate({ startDate, isTravelingToPast: true });
                        expect(actualPrevMoon.toFormat(dateFormat)).toBe(expectedPrevMoon.toFormat(dateFormat));
                    });
                });
            });
            describe('next moon', () => {
                preCalculatedNewMoons2019.forEach((moon, idx) => {
                    let expectedPrevMoon = moon;
                    let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                    if (idx === preCalculatedNewMoons2019.length - 1) {
                        expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                        expectedNextMoon = moon;
                    }
                    test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                        const startDate = expectedPrevMoon.plus({ [timeShift.unit]: timeShift.value });
                        const actualNextMoon = moonCalc.getNewMoonDate({ startDate });
                        expect(actualNextMoon.toFormat(dateFormat)).toBe(expectedNextMoon.toFormat(dateFormat));
                    });
                });
            });
        });
    });
    describe('middle of month', () => {
        const timeShift = { unit: 'days', value: 15 };
        describe('prev moon', () => {
            preCalculatedNewMoons2019.forEach((moon, idx) => {
                let expectedPrevMoon = moon;
                let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                if (idx === preCalculatedNewMoons2019.length - 1) {
                    expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                    expectedNextMoon = moon;
                }
                test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                    const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                    const actualPrevMoon = moonCalc.getNewMoonDate({ startDate, isTravelingToPast: true });
                    expect(actualPrevMoon.toFormat(dateFormat)).toBe(expectedPrevMoon.toFormat(dateFormat));
                });
            });
        });
        describe('next moon', () => {
            preCalculatedNewMoons2019.forEach((moon, idx) => {
                let expectedPrevMoon = moon;
                let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                if (idx === preCalculatedNewMoons2019.length - 1) {
                    expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                    expectedNextMoon = moon;
                }
                test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                    const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                    const actualNextMoon = moonCalc.getNewMoonDate({ startDate });
                    expect(actualNextMoon.toFormat(dateFormat)).toBe(expectedNextMoon.toFormat(dateFormat));
                });
            });
        });
    });
    describe('moment of new moon', () => {
        const timeShift = { unit: 'minutes', value: 0 };
        describe('prev moon', () => {
            preCalculatedNewMoons2019.forEach((moon, idx) => {
                let expectedPrevMoon = moon;
                let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                if (idx === preCalculatedNewMoons2019.length - 1) {
                    expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                    expectedNextMoon = moon;
                }
                test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                    const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                    const actualPrevMoon = moonCalc.getNewMoonDate({ startDate, isTravelingToPast: true });
                    expect(actualPrevMoon.toFormat(dateFormat)).toBe(expectedPrevMoon.toFormat(dateFormat));
                });
            });
        });
        describe('next moon', () => {
            preCalculatedNewMoons2019.forEach((moon, idx) => {
                let expectedPrevMoon = moon;
                let expectedNextMoon = preCalculatedNewMoons2019[idx + 1];
                if (idx === preCalculatedNewMoons2019.length - 1) {
                    expectedPrevMoon = preCalculatedNewMoons2019[idx - 1];
                    expectedNextMoon = moon;
                }
                test(`${expectedPrevMoon.toFormat(dateFormat)} - ${expectedNextMoon.toFormat(dateFormat)}`, () => {
                    const startDate = expectedNextMoon.minus({ [timeShift.unit]: timeShift.value });
                    const actualNextMoon = moonCalc.getNewMoonDate({ startDate });
                    expect(actualNextMoon.toFormat(dateFormat)).toBe(expectedNextMoon.toFormat(dateFormat));
                });
            });
        });
    });
});
