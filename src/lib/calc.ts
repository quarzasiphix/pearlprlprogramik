import type { Gpu, Settings, Tier } from "../types";
import { TIERS } from "../types";

export interface Row {
  gpu: Gpu;
  tier: Tier;
  /** Rental cost per day in USD (pricePerHour * 24). */
  costPerDay: number;
  /** Electricity cost per day in USD (kW * 24 * price/kWh). */
  electricityPerDay: number;
  /** Total cost per day (rental + electricity). */
  totalCostPerDay: number;
  /** PRL mined per day. */
  prlPerDay: number;
  /** Gross revenue per day in USD. */
  revenuePerDay: number;
  /** Net profit per day in USD (revenue - rental - electricity). */
  profitPerDay: number;
  /** Profit as a percentage of total cost. */
  roiPercent: number;
}

/** Electricity price per kWh converted to USD (the app's base currency). */
export function electricityUsdPerKWh(settings: Settings): number {
  if (settings.electricityCurrency === "PLN") {
    const rate = settings.usdPlnRate > 0 ? settings.usdPlnRate : 1;
    return settings.electricityPricePerKWh / rate;
  }
  return settings.electricityPricePerKWh;
}

export function electricityPerDay(gpu: Gpu, settings: Settings): number {
  return (gpu.power / 1000) * 24 * electricityUsdPerKWh(settings);
}

/** PRL mined per 1 TH/s per day, derived from network parameters. */
export function factorFromNetwork(
  netHashrateThs: number,
  blockRewardPrl: number,
  blockTimeSec: number,
): number {
  if (netHashrateThs <= 0 || blockTimeSec <= 0) return 0;
  return (blockRewardPrl * 86400) / (blockTimeSec * netHashrateThs);
}

export function prlPerDay(gpu: Gpu, settings: Settings): number {
  return gpu.hashrate * settings.prlPerThPerDay;
}

export function revenuePerDay(gpu: Gpu, settings: Settings): number {
  return prlPerDay(gpu, settings) * settings.prlPrice;
}

export function costPerDay(gpu: Gpu, tier: Tier): number {
  return gpu.prices[tier] * 24;
}

export function computeRow(gpu: Gpu, tier: Tier, settings: Settings): Row {
  const cost = costPerDay(gpu, tier);
  const elec = electricityPerDay(gpu, settings);
  const totalCost = cost + elec;
  const prl = prlPerDay(gpu, settings);
  const revenue = prl * settings.prlPrice;
  const profit = revenue - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  return {
    gpu,
    tier,
    costPerDay: cost,
    electricityPerDay: elec,
    totalCostPerDay: totalCost,
    prlPerDay: prl,
    revenuePerDay: revenue,
    profitPerDay: profit,
    roiPercent: roi,
  };
}

/** Every GPU x tier combination, sorted by profit per day (best first). */
export function bestOptions(gpus: Gpu[], settings: Settings): Row[] {
  const rows: Row[] = [];
  for (const gpu of gpus) {
    for (const tier of TIERS) {
      rows.push(computeRow(gpu, tier, settings));
    }
  }
  rows.sort((a, b) => b.profitPerDay - a.profitPerDay);
  return rows;
}
