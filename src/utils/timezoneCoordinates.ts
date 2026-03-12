/**
 * Timezone Coordinates Lookup
 *
 * Maps IANA timezone identifiers to approximate geographic centroid coordinates
 * (latitude, longitude). Used by the TzGlobePicker component to rotate the globe to
 * the correct position for a given timezone.
 *
 * Coordinates represent the approximate center of each timezone's primary region.
 * Not every IANA timezone has an entry — the globe will fall back to [0, 0] for
 * unknown zones.
 *
 * @module timezoneCoordinates
 */

/** Coordinate tuple: [latitude, longitude] in degrees */
export type LatLng = [number, number];

/**
 * Lookup map from IANA timezone ID → approximate [lat, lng] centroid.
 *
 * @example
 * ```typescript
 * import { TIMEZONE_COORDINATES } from './timezoneCoordinates'
 * const [lat, lng] = TIMEZONE_COORDINATES['America/New_York'] ?? [0, 0]
 * ```
 */
export const TIMEZONE_COORDINATES: Record<string, LatLng> = {
  // ── Africa ──────────────────────────────────────────────
  "Africa/Abidjan": [5.32, -4.03],
  "Africa/Accra": [5.56, -0.2],
  "Africa/Addis_Ababa": [9.02, 38.75],
  "Africa/Algiers": [36.75, 3.06],
  "Africa/Cairo": [30.04, 31.24],
  "Africa/Casablanca": [33.59, -7.62],
  "Africa/Dar_es_Salaam": [-6.79, 39.28],
  "Africa/Johannesburg": [-26.2, 28.04],
  "Africa/Kampala": [0.35, 32.58],
  "Africa/Khartoum": [15.5, 32.56],
  "Africa/Kinshasa": [-4.32, 15.31],
  "Africa/Lagos": [6.45, 3.4],
  "Africa/Luanda": [-8.84, 13.23],
  "Africa/Maputo": [-25.97, 32.58],
  "Africa/Nairobi": [-1.29, 36.82],
  "Africa/Tunis": [36.81, 10.18],
  "Africa/Tripoli": [32.9, 13.18],

  // ── Americas ────────────────────────────────────────────
  "America/Adak": [51.88, -176.66],
  "America/Anchorage": [61.22, -149.9],
  "America/Argentina/Buenos_Aires": [-34.6, -58.38],
  "America/Argentina/Cordoba": [-31.42, -64.18],
  "America/Asuncion": [-25.26, -57.58],
  "America/Atikokan": [48.76, -91.62],
  "America/Bahia": [-12.97, -38.51],
  "America/Belem": [-1.46, -48.5],
  "America/Bogota": [4.71, -74.07],
  "America/Boise": [43.62, -116.2],
  "America/Campo_Grande": [-20.44, -54.65],
  "America/Cancun": [21.16, -86.85],
  "America/Caracas": [10.49, -66.88],
  "America/Chicago": [41.88, -87.63],
  "America/Chihuahua": [28.63, -106.09],
  "America/Costa_Rica": [9.93, -84.08],
  "America/Cuiaba": [-15.6, -56.1],
  "America/Denver": [39.74, -104.98],
  "America/Detroit": [42.33, -83.05],
  "America/Edmonton": [53.55, -113.49],
  "America/El_Salvador": [13.69, -89.22],
  "America/Fortaleza": [-3.72, -38.53],
  "America/Guatemala": [14.64, -90.51],
  "America/Guayaquil": [-2.17, -79.92],
  "America/Halifax": [44.65, -63.57],
  "America/Havana": [23.11, -82.37],
  "America/Indiana/Indianapolis": [39.77, -86.16],
  "America/Jamaica": [18.11, -77.3],
  "America/Juneau": [58.3, -134.42],
  "America/La_Paz": [-16.5, -68.15],
  "America/Lima": [-12.05, -77.03],
  "America/Los_Angeles": [34.05, -118.24],
  "America/Managua": [12.11, -86.27],
  "America/Manaus": [-3.12, -60.02],
  "America/Mazatlan": [23.22, -106.42],
  "America/Mexico_City": [19.43, -99.13],
  "America/Miquelon": [47.1, -56.38],
  "America/Montevideo": [-34.88, -56.16],
  "America/Montreal": [45.5, -73.57],
  "America/Nassau": [25.05, -77.35],
  "America/New_York": [40.71, -74.01],
  "America/Noronha": [-3.85, -32.42],
  "America/Panama": [8.97, -79.53],
  "America/Paramaribo": [5.85, -55.17],
  "America/Phoenix": [33.45, -112.07],
  "America/Port-au-Prince": [18.54, -72.34],
  "America/Porto_Velho": [-8.76, -63.9],
  "America/Puerto_Rico": [18.47, -66.12],
  "America/Recife": [-8.05, -34.87],
  "America/Regina": [50.45, -104.62],
  "America/Rio_Branco": [-9.97, -67.81],
  "America/Santiago": [-33.45, -70.67],
  "America/Santo_Domingo": [18.49, -69.93],
  "America/Sao_Paulo": [-23.55, -46.63],
  "America/St_Johns": [47.56, -52.71],
  "America/Tegucigalpa": [14.07, -87.19],
  "America/Tijuana": [32.53, -117.02],
  "America/Toronto": [43.65, -79.38],
  "America/Vancouver": [49.26, -123.11],
  "America/Winnipeg": [49.9, -97.14],

  // ── Asia ────────────────────────────────────────────────
  "Asia/Almaty": [43.24, 76.95],
  "Asia/Amman": [31.96, 35.95],
  "Asia/Baghdad": [33.31, 44.37],
  "Asia/Baku": [40.41, 49.87],
  "Asia/Bangkok": [13.76, 100.5],
  "Asia/Beirut": [33.89, 35.5],
  "Asia/Bishkek": [42.87, 74.59],
  "Asia/Brunei": [4.93, 114.95],
  "Asia/Calcutta": [22.57, 88.36],
  "Asia/Colombo": [6.93, 79.85],
  "Asia/Damascus": [33.51, 36.29],
  "Asia/Dhaka": [23.81, 90.41],
  "Asia/Dubai": [25.2, 55.27],
  "Asia/Dushanbe": [38.56, 68.77],
  "Asia/Gaza": [31.5, 34.47],
  "Asia/Ho_Chi_Minh": [10.82, 106.63],
  "Asia/Hong_Kong": [22.28, 114.16],
  "Asia/Irkutsk": [52.29, 104.3],
  "Asia/Istanbul": [41.01, 28.98],
  "Asia/Jakarta": [-6.21, 106.85],
  "Asia/Jerusalem": [31.77, 35.22],
  "Asia/Kabul": [34.53, 69.17],
  "Asia/Karachi": [24.86, 67.01],
  "Asia/Kathmandu": [27.72, 85.32],
  "Asia/Kolkata": [28.61, 77.21],
  "Asia/Krasnoyarsk": [56.01, 92.87],
  "Asia/Kuala_Lumpur": [3.14, 101.69],
  "Asia/Kuwait": [29.38, 47.99],
  "Asia/Macau": [22.2, 113.55],
  "Asia/Magadan": [59.57, 150.8],
  "Asia/Manila": [14.6, 120.98],
  "Asia/Muscat": [23.59, 58.39],
  "Asia/Nicosia": [35.17, 33.37],
  "Asia/Novosibirsk": [55.03, 82.92],
  "Asia/Omsk": [54.99, 73.37],
  "Asia/Phnom_Penh": [11.56, 104.92],
  "Asia/Pyongyang": [39.02, 125.75],
  "Asia/Qatar": [25.29, 51.53],
  "Asia/Riyadh": [24.69, 46.72],
  "Asia/Sakhalin": [46.96, 142.73],
  "Asia/Samarkand": [39.65, 66.96],
  "Asia/Seoul": [37.57, 126.98],
  "Asia/Shanghai": [31.23, 121.47],
  "Asia/Singapore": [1.35, 103.82],
  "Asia/Taipei": [25.03, 121.57],
  "Asia/Tashkent": [41.3, 69.24],
  "Asia/Tbilisi": [41.72, 44.79],
  "Asia/Tehran": [35.69, 51.39],
  "Asia/Thimphu": [27.47, 89.64],
  "Asia/Tokyo": [35.68, 139.69],
  "Asia/Ulaanbaatar": [47.92, 106.92],
  "Asia/Vladivostok": [43.12, 131.87],
  "Asia/Yakutsk": [62.03, 129.73],
  "Asia/Yangon": [16.87, 96.2],
  "Asia/Yekaterinburg": [56.84, 60.6],
  "Asia/Yerevan": [40.18, 44.51],

  // ── Atlantic ────────────────────────────────────────────
  "Atlantic/Azores": [38.72, -27.22],
  "Atlantic/Bermuda": [32.29, -64.78],
  "Atlantic/Canary": [28.1, -15.41],
  "Atlantic/Cape_Verde": [14.93, -23.51],
  "Atlantic/Reykjavik": [64.14, -21.94],
  "Atlantic/South_Georgia": [-54.27, -36.51],

  // ── Australia ───────────────────────────────────────────
  "Australia/Adelaide": [-34.93, 138.6],
  "Australia/Brisbane": [-27.47, 153.03],
  "Australia/Broken_Hill": [-31.95, 141.47],
  "Australia/Darwin": [-12.46, 130.84],
  "Australia/Eucla": [-31.68, 128.88],
  "Australia/Hobart": [-42.88, 147.33],
  "Australia/Lord_Howe": [-31.55, 159.08],
  "Australia/Melbourne": [-37.81, 144.96],
  "Australia/Perth": [-31.95, 115.86],
  "Australia/Sydney": [-33.87, 151.21],

  // ── Europe ──────────────────────────────────────────────
  "Europe/Amsterdam": [52.37, 4.9],
  "Europe/Andorra": [42.51, 1.52],
  "Europe/Athens": [37.98, 23.73],
  "Europe/Belgrade": [44.79, 20.47],
  "Europe/Berlin": [52.52, 13.41],
  "Europe/Bratislava": [48.15, 17.11],
  "Europe/Brussels": [50.85, 4.35],
  "Europe/Bucharest": [44.43, 26.1],
  "Europe/Budapest": [47.5, 19.04],
  "Europe/Chisinau": [47.01, 28.86],
  "Europe/Copenhagen": [55.68, 12.57],
  "Europe/Dublin": [53.33, -6.25],
  "Europe/Helsinki": [60.17, 24.94],
  "Europe/Kaliningrad": [54.71, 20.45],
  "Europe/Kiev": [50.45, 30.52],
  "Europe/Kyiv": [50.45, 30.52],
  "Europe/Lisbon": [38.72, -9.14],
  "Europe/Ljubljana": [46.06, 14.51],
  "Europe/London": [51.51, -0.13],
  "Europe/Luxembourg": [49.61, 6.13],
  "Europe/Madrid": [40.42, -3.7],
  "Europe/Malta": [35.9, 14.51],
  "Europe/Minsk": [53.9, 27.57],
  "Europe/Monaco": [43.73, 7.42],
  "Europe/Moscow": [55.76, 37.62],
  "Europe/Oslo": [59.91, 10.75],
  "Europe/Paris": [48.86, 2.35],
  "Europe/Prague": [50.08, 14.42],
  "Europe/Riga": [56.95, 24.11],
  "Europe/Rome": [41.9, 12.5],
  "Europe/Samara": [53.2, 50.15],
  "Europe/Sarajevo": [43.86, 18.41],
  "Europe/Simferopol": [44.95, 34.1],
  "Europe/Sofia": [42.7, 23.32],
  "Europe/Stockholm": [59.33, 18.07],
  "Europe/Tallinn": [59.44, 24.75],
  "Europe/Tirane": [41.33, 19.82],
  "Europe/Vienna": [48.21, 16.37],
  "Europe/Vilnius": [54.69, 25.28],
  "Europe/Volgograd": [48.72, 44.5],
  "Europe/Warsaw": [52.23, 21.01],
  "Europe/Zagreb": [45.81, 15.98],
  "Europe/Zurich": [47.38, 8.54],

  // ── Indian ──────────────────────────────────────────────
  "Indian/Maldives": [4.18, 73.51],
  "Indian/Mauritius": [-20.16, 57.5],
  "Indian/Reunion": [-20.88, 55.45],

  // ── Pacific ─────────────────────────────────────────────
  "Pacific/Auckland": [-36.85, 174.76],
  "Pacific/Chatham": [-43.88, -176.46],
  "Pacific/Easter": [-27.12, -109.35],
  "Pacific/Fiji": [-18.14, 178.44],
  "Pacific/Galapagos": [-0.75, -90.3],
  "Pacific/Gambier": [-23.12, -134.97],
  "Pacific/Guadalcanal": [-9.43, 160.05],
  "Pacific/Guam": [13.44, 144.79],
  "Pacific/Honolulu": [21.31, -157.86],
  "Pacific/Marquesas": [-9.78, -139.03],
  "Pacific/Noumea": [-22.28, 166.46],
  "Pacific/Pago_Pago": [-14.28, -170.7],
  "Pacific/Port_Moresby": [-6.21, 147.0],
  "Pacific/Tahiti": [-17.53, -149.57],
  "Pacific/Tongatapu": [-21.21, -175.2],

  // ── UTC/GMT ─────────────────────────────────────────────
  UTC: [0, 0],
  GMT: [0, 0],
  "Etc/UTC": [0, 0],
  "Etc/GMT": [0, 0],
};

/**
 * Get the approximate geographic centroid for a given IANA timezone.
 * Falls back to [0, 0] (Gulf of Guinea) for unknown timezones.
 *
 * @param timezone - IANA timezone identifier (e.g. "America/New_York")
 * @returns Coordinate tuple [latitude, longitude] in degrees
 *
 * @example
 * ```typescript
 * const [lat, lng] = getTimezoneCenter('America/Sao_Paulo')
 * // Returns: [-23.55, -46.63]
 * ```
 */
export function getTimezoneCenter(timezone: string): LatLng {
  return TIMEZONE_COORDINATES[timezone] ?? [0, 0];
}
