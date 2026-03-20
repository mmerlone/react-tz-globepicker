/**
 * Common IANA timezones that are pre-loaded for IANA boundary mode.
 * This is a curated set of popular timezones to avoid loading all 400+ zones.
 */
export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "America/Denver",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Etc/UTC",
] as const;

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number];
