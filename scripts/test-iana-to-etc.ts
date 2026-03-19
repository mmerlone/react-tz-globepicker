import { ianaToEtc, offsetKeyFromEtc } from "../src/utils/timezoneMapping";

const cases: Array<[string, string]> = [
  ["America/New_York", "UTC-05:00"],
  ["America/Los_Angeles", "UTC-08:00"],
  ["Asia/Kolkata", "UTC+05:30"],
  ["Pacific/Chatham", "UTC+12:45"],
  ["UTC", "UTC+00:00"],
];

let failed = 0;
for (const [input, expected] of cases) {
  try {
    const got = ianaToEtc(input);
    if (got !== expected) {
      console.error(`FAIL: ${input} -> expected ${expected}, got ${got}`);
      failed++;
    } else {
      console.log(`ok: ${input} -> ${got}`);
    }
  } catch (e) {
    console.error(`ERROR: ${input} threw`, e);
    failed++;
  }
}

// Basic etc parsing test
const etcCases: Array<[string, string]> = [
  ["Etc/GMT+5", "UTC-05:00"],
  ["Etc/GMT-3", "UTC+03:00"],
  ["GMT+05:30", "UTC+05:30"],
];
for (const [input, expected] of etcCases) {
  try {
    const got = offsetKeyFromEtc(input);
    if (got !== expected) {
      console.error(`FAIL: ${input} -> expected ${expected}, got ${got}`);
      failed++;
    } else {
      console.log(`ok: ${input} -> ${got}`);
    }
  } catch (e) {
    console.error(`ERROR: ${input} threw`, e);
    failed++;
  }
}

if (failed > 0) {
  console.error(`${failed} tests failed`);
  process.exit(1);
}
console.log("All tests passed");
