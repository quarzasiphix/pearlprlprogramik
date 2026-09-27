export function usd(value: number, digits = 2): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function prl(value: number): string {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} PRL`;
}

export function ths(value: number): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} TH/s`;
}

export function pct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}%`;
}
