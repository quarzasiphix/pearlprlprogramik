export type Tier = "lowest" | "low" | "medium" | "high";

export const TIERS: Tier[] = ["lowest", "low", "medium", "high"];

export const TIER_LABELS: Record<Tier, string> = {
  lowest: "At lowest",
  low: "At low",
  medium: "At medium",
  high: "At high",
};

export const TIER_TEXT_COLORS: Record<Tier, string> = {
  lowest: "text-emerald-400",
  low: "text-yellow-400",
  medium: "text-orange-400",
  high: "text-red-500",
};

export interface Gpu {
  id: string;
  name: string;
  /** Rental price in USD per hour for each Salad priority tier. */
  prices: Record<Tier, number>;
  /** Mining hashrate in TH/s for pearlhash. */
  hashrate: number;
  /** Power draw in watts (used for electricity cost on own hardware). */
  power: number;
  /** true when the hashrate is our estimate, not a value you provided. */
  estimated: boolean;
}

export interface Settings {
  /** Current PRL price in USD. */
  prlPrice: number;
  /** PRL mined per 1 TH/s over 24h. Derived from network params below (editable). */
  prlPerThPerDay: number;
  /** Network difficulty (informational, editable, filled on refresh). */
  networkDifficulty: number;
  /** Total network hashrate in TH/s (drives the yield). */
  networkHashrateThs: number;
  /** Block reward in PRL. */
  blockRewardPrl: number;
  /** Average block time in seconds. */
  blockTimeSec: number;
  /** Optional CoinGecko coin id used by the "refresh price" button. */
  coinGeckoId: string;
  /** Auto-refresh the PRL price on an interval. */
  autoRefresh: boolean;
  /** Auto-refresh interval in seconds. */
  refreshIntervalSec: number;
  /** herominers-style pool stats endpoint used to auto-calibrate the yield. */
  statsUrl: string;
  /** Electricity price per kWh, expressed in `electricityCurrency`.
   *  0 = free (e.g. Salad, where power is included in the rental price). */
  electricityPricePerKWh: number;
  /** Currency of the electricity price the user typed. */
  electricityCurrency: "USD" | "PLN";
  /** How many PLN per 1 USD (used to convert PLN electricity price to USD). */
  usdPlnRate: number;
}

export interface AppState {
  gpus: Gpu[];
  settings: Settings;
}
