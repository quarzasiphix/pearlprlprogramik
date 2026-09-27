import type { AppState, Gpu } from "../types";

// Prices are Salad rental $/hour in tier order: lowest, low, medium, high.
// Hashrates are TH/s for pearlhash.
//   - RTX 5080 (223), RTX 4090 (288), RTX 5070 (124): values provided by you.
//   - The rest: SRBMiner pearlhash benchmarks from hashrate.no (Sep 2026).
// "estimated" only stays true when we have no benchmark and it's a rough guess.
export const DEFAULT_GPUS: Gpu[] = [
  {
    id: "rtx-5090",
    name: "RTX 5090",
    prices: { lowest: 0.25, low: 0.333, medium: 0.417, high: 0.5 },
    hashrate: 417.9,
    power: 519,
    estimated: false,
  },
  {
    id: "rtx-4090",
    name: "RTX 4090",
    prices: { lowest: 0.16, low: 0.217, medium: 0.273, high: 0.33 },
    hashrate: 288,
    power: 400,
    estimated: false,
  },
  {
    id: "rtx-5080",
    name: "RTX 5080",
    prices: { lowest: 0.15, low: 0.187, medium: 0.223, high: 0.26 },
    hashrate: 223,
    power: 271,
    estimated: false,
  },
  {
    id: "rtx-5090-laptop",
    name: "RTX 5090 Laptop",
    prices: { lowest: 0.1, low: 0.145, medium: 0.19, high: 0.235 },
    hashrate: 180,
    power: 150,
    estimated: true,
  },
  {
    id: "rtx-4080",
    name: "RTX 4080",
    prices: { lowest: 0.11, low: 0.15, medium: 0.19, high: 0.23 },
    hashrate: 159.3,
    power: 257,
    estimated: false,
  },
  {
    id: "rtx-5070-ti",
    name: "RTX 5070 Ti",
    prices: { lowest: 0.1, low: 0.142, medium: 0.183, high: 0.225 },
    hashrate: 170.5,
    power: 214,
    estimated: false,
  },
  {
    id: "rtx-4070-ti-super",
    name: "RTX 4070 Ti Super",
    prices: { lowest: 0.09, low: 0.13, medium: 0.17, high: 0.21 },
    hashrate: 155.4,
    power: 220,
    estimated: false,
  },
  {
    id: "rtx-4070-ti",
    name: "RTX 4070 Ti",
    prices: { lowest: 0.08, low: 0.12, medium: 0.16, high: 0.2 },
    hashrate: 142.3,
    power: 175,
    estimated: false,
  },
  {
    id: "rtx-3090-ti",
    name: "RTX 3090 Ti",
    prices: { lowest: 0.1, low: 0.13, medium: 0.16, high: 0.19 },
    hashrate: 121.4,
    power: 237,
    estimated: false,
  },
  {
    id: "rtx-3090",
    name: "RTX 3090",
    prices: { lowest: 0.09, low: 0.117, medium: 0.143, high: 0.17 },
    hashrate: 110.0,
    power: 250,
    estimated: false,
  },
  {
    id: "rtx-5070",
    name: "RTX 5070",
    prices: { lowest: 0.08, low: 0.108, medium: 0.137, high: 0.165 },
    hashrate: 124,
    power: 168,
    estimated: false,
  },
  {
    id: "rtx-3080-ti",
    name: "RTX 3080 Ti",
    prices: { lowest: 0.08, low: 0.105, medium: 0.13, high: 0.155 },
    hashrate: 116.2,
    power: 268,
    estimated: false,
  },
  {
    id: "rtx-5060-ti",
    name: "RTX 5060 Ti",
    prices: { lowest: 0.07, low: 0.097, medium: 0.123, high: 0.15 },
    hashrate: 87.3,
    power: 114,
    estimated: false,
  },
  {
    id: "rtx-4070",
    name: "RTX 4070",
    prices: { lowest: 0.07, low: 0.097, medium: 0.123, high: 0.15 },
    hashrate: 115.5,
    power: 173,
    estimated: false,
  },
  {
    id: "rtx-4060-ti",
    name: "RTX 4060 Ti",
    prices: { lowest: 0.08, low: 0.1, medium: 0.12, high: 0.14 },
    hashrate: 90.5,
    power: 148,
    estimated: false,
  },
  {
    id: "rtx-3080",
    name: "RTX 3080",
    prices: { lowest: 0.06, low: 0.087, medium: 0.113, high: 0.14 },
    hashrate: 105.2,
    power: 227,
    estimated: false,
  },
  {
    id: "rtx-5060",
    name: "RTX 5060",
    prices: { lowest: 0.065, low: 0.08, medium: 0.095, high: 0.11 },
    hashrate: 72.2,
    power: 97,
    estimated: false,
  },
];

export const DEFAULT_STATE: AppState = {
  gpus: DEFAULT_GPUS,
  settings: {
    // Current PRL price from CoinGecko (pearl-2). Update with "Odśwież cenę".
    prlPrice: 1.26,
    // Derived from network params below: reward*86400/(blockTime*netHashTHs).
    prlPerThPerDay: 0.0251,
    // Live snapshot from pearl.herominers.com/api/stats (recalibrate with "Odśwież dane sieci").
    networkDifficulty: 1800962122626,
    networkHashrateThs: 46616902,
    blockRewardPrl: 2311.3,
    blockTimeSec: 170.66,
    coinGeckoId: "pearl-2",
    autoRefresh: false,
    refreshIntervalSec: 60,
    statsUrl: "https://pearl.herominers.com/api/stats",
    // 0 = prąd wliczony w wynajem (Salad). Ustaw > 0 dla własnego sprzętu.
    electricityPricePerKWh: 0,
    electricityCurrency: "USD",
    usdPlnRate: 3.84,
  },
};
