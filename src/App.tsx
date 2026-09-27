import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Gpu, Settings, Tier } from "./types";
import { TIERS, TIER_LABELS, TIER_TEXT_COLORS } from "./types";
import { DEFAULT_STATE } from "./data/defaults";
import { useLocalStorage } from "./hooks/useLocalStorage";
import {
  bestOptions,
  computeRow,
  electricityPerDay,
  factorFromNetwork,
  prlPerDay,
  revenuePerDay,
} from "./lib/calc";
import { pct, prl, ths, usd } from "./lib/format";

type Tab = "calculator" | "best" | "fleet" | "settings";

const STORAGE_KEY = "prl-profit-calculator-v9";

export default function App() {
  const [state, setState] = useLocalStorage(STORAGE_KEY, DEFAULT_STATE);
  const [tab, setTab] = useState<Tab>("calculator");
  const [days, setDays] = useState(1);

  const { gpus, settings } = state;

  const setSettings = (patch: Partial<Settings>) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const setGpus = (updater: (g: Gpu[]) => Gpu[]) =>
    setState((s) => ({ ...s, gpus: updater(s.gpus) }));

  return (
    <div className="min-h-full">
      <Header settings={settings} setSettings={setSettings} />

      <nav className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          <TabButton active={tab === "calculator"} onClick={() => setTab("calculator")}>
            Kalkulator
          </TabButton>
          <TabButton active={tab === "best"} onClick={() => setTab("best")}>
            Najlepsze opcje
          </TabButton>
          <TabButton active={tab === "fleet"} onClick={() => setTab("fleet")}>
            Moje GPU
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            Ustawienia
          </TabButton>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {(tab === "calculator" || tab === "best") && gpus.length > 0 && <PeriodPicker days={days} setDays={setDays} />}
        {tab === "calculator" && <CalculatorTab gpus={gpus} settings={settings} days={days} />}
        {tab === "best" && <BestTab gpus={gpus} settings={settings} days={days} />}
        {tab === "fleet" && <FleetTab gpus={gpus} settings={settings} />}
        {tab === "settings" && (
          <SettingsTab
            gpus={gpus}
            settings={settings}
            setSettings={setSettings}
            setGpus={setGpus}
            resetAll={() => setState(structuredClone(DEFAULT_STATE))}
          />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-white/40">
        Kopanie Pearl (PRL) · pearlhash · dane liczone dla 1 karty · zysk = przychód − koszt
        wynajmu (cena/h × 24). Wszystkie wartości edytujesz w zakładce Ustawienia; zapisują się
        w tej przeglądarce.
      </footer>
    </div>
  );
}

function Header({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Keep the latest coinGeckoId in a ref so the interval always uses fresh value.
  const idRef = useRef(settings.coinGeckoId);
  idRef.current = settings.coinGeckoId;

  const refreshPrice = useCallback(
    async (silent = false) => {
      const id = idRef.current.trim() || "pearl-2";
      setFetching(true);
      if (!silent) setMsg(null);
      try {
        // Primary endpoint.
        let price: number | undefined;
        try {
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
              id,
            )}&vs_currencies=usd`,
          );
          const data = await res.json();
          price = data?.[id]?.usd;
        } catch {
          /* fall through to fallback */
        }
        // Fallback endpoint (markets) if the first one failed.
        if (typeof price !== "number") {
          const res2 = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
              id,
            )}`,
          );
          const arr = await res2.json();
          price = Array.isArray(arr) ? arr[0]?.current_price : undefined;
        }
        if (typeof price === "number") {
          setSettings({ prlPrice: price });
          setLastUpdated(new Date());
          setMsg(`Aktualna cena PRL: $${price}`);
        } else {
          setMsg("Nie znaleziono ceny (sprawdź CoinGecko ID).");
        }
      } catch {
        setMsg("Błąd pobierania ceny (brak internetu / limit API). Cena pozostaje ręczna.");
      } finally {
        setFetching(false);
      }
    },
    [setSettings],
  );

  // Fetch the real price once as soon as the app opens.
  const didInitialFetch = useRef(false);
  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    refreshPrice(true);
  }, [refreshPrice]);

  // Auto-refresh loop.
  useEffect(() => {
    if (!settings.autoRefresh) return;
    const sec = Math.max(15, settings.refreshIntervalSec || 60);
    refreshPrice(true); // immediate refresh when enabled
    const t = setInterval(() => refreshPrice(true), sec * 1000);
    return () => clearInterval(t);
  }, [settings.autoRefresh, settings.refreshIntervalSec, refreshPrice]);

  return (
    <header className="border-b border-white/10 bg-gradient-to-b from-emerald-500/10 to-transparent">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Kalkulator zysku — PRL na Salad
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Wynajmij GPU, kop Pearl (pearlhash) i sprawdź dzienny zysk dla każdego priorytetu.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <LabeledField label="Cena PRL (USD)">
            <NumberInput
              value={settings.prlPrice}
              onChange={(v) => setSettings({ prlPrice: v })}
              step={0.0001}
              className="w-32"
            />
          </LabeledField>
          <LabeledField label="PRL / TH / dzień">
            <NumberInput
              value={settings.prlPerThPerDay}
              onChange={(v) => setSettings({ prlPerThPerDay: v })}
              step={0.0001}
              className="w-32"
            />
          </LabeledField>
          <button
            onClick={() => refreshPrice(false)}
            disabled={fetching}
            className="h-[38px] rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {fetching ? "Pobieram…" : "Odśwież cenę"}
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-xs">
        <label className="flex cursor-pointer items-center gap-2 text-white/70">
          <input
            type="checkbox"
            checked={settings.autoRefresh}
            onChange={(e) => setSettings({ autoRefresh: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          Auto-odświeżanie ceny co
        </label>
        <input
          type="number"
          min={15}
          value={settings.refreshIntervalSec}
          onChange={(e) =>
            setSettings({ refreshIntervalSec: Math.max(15, parseInt(e.target.value) || 60) })
          }
          className="w-16 rounded border border-white/15 bg-black/30 px-2 py-1 text-white outline-none focus:border-emerald-400/60"
        />
        <span className="text-white/70">sekund (min. 15 — limit CoinGecko)</span>
        {settings.autoRefresh && (
          <span className="flex items-center gap-1 text-emerald-300/90">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            aktywne
          </span>
        )}
        {lastUpdated && (
          <span className="text-white/40">
            ost. aktualizacja: {lastUpdated.toLocaleTimeString("pl-PL")}
          </span>
        )}
        {msg && <span className="text-white/50">· {msg}</span>}
      </div>
    </header>
  );
}

const PERIOD_PRESETS: { label: string; days: number }[] = [
  { label: "Godzina", days: 1 / 24 },
  { label: "Dzień", days: 1 },
  { label: "Tydzień", days: 7 },
  { label: "Miesiąc", days: 30 },
  { label: "Rok", days: 365 },
];

const PROFIT_TARGET_USD = 5;

/** Hours of mining until the profit reaches $5, or "nigdy" when the row loses money. */
function hoursToTarget(profitPerDay: number): string {
  if (profitPerDay <= 0) return "nigdy";
  const hours = (PROFIT_TARGET_USD / profitPerDay) * 24;
  if (hours >= 48) return `${+(hours / 24).toFixed(1)} dni`;
  return `${+hours.toFixed(1)}h`;
}

/** Long label ("w 24h", "w 30 dni") and short suffix ("/d", "/30 dni") for a period. */
function periodLabels(days: number): { long: string; short: string } {
  if (days === 1 / 24) return { long: "w 1h", short: "h" };
  if (days === 1) return { long: "w 24h", short: "dzień" };
  if (days === 7) return { long: "w tydzień", short: "tydz." };
  if (days === 30) return { long: "w miesiąc (30 dni)", short: "mies." };
  if (days === 365) return { long: "w rok", short: "rok" };
  const hours = +(days * 24).toFixed(2);
  if (days < 1 || !Number.isInteger(days)) return { long: `w ${hours}h`, short: `${hours}h` };
  return { long: `w ${days} dni`, short: `${days} dni` };
}

function PeriodPicker({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const isPreset = PERIOD_PRESETS.some((p) => p.days === days);
  const [custom, setCustom] = useState("");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const applyCustom = (value: string, u: "hours" | "days") => {
    const v = parseFloat(value);
    if (v > 0) setDays(u === "hours" ? v / 24 : v);
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs text-white/50">Okres:</span>
      {PERIOD_PRESETS.map((p) => (
        <SortButton
          key={p.label}
          active={days === p.days}
          onClick={() => {
            setDays(p.days);
            setCustom("");
          }}
        >
          {p.label}
        </SortButton>
      ))}
      <label className="flex items-center gap-2 text-sm text-white/70">
        lub
        <input
          type="number"
          min={0}
          step="any"
          placeholder={unit === "hours" ? "ile godzin" : "ile dni"}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            applyCustom(e.target.value, unit);
          }}
          className={`w-24 rounded-lg border bg-black/30 px-2 py-1.5 text-white outline-none focus:border-emerald-400/60 ${
            !isPreset ? "border-emerald-400/60" : "border-white/15"
          }`}
        />
      </label>
      {(["hours", "days"] as const).map((u) => (
        <SortButton
          key={u}
          active={unit === u}
          onClick={() => {
            setUnit(u);
            applyCustom(custom, u);
          }}
        >
          {u === "hours" ? "godzin" : "dni"}
        </SortButton>
      ))}
    </div>
  );
}

function CalculatorTab({
  gpus,
  settings,
  days,
}: {
  gpus: Gpu[];
  settings: Settings;
  days: number;
}) {
  const [counts, setCounts] = useLocalStorage<Record<string, number>>(
    "prl-profit-calculator-counts-v1",
    {},
  );
  if (gpus.length === 0) return <EmptyState />;
  return (
    <div className="grid gap-4">
      {gpus.map((gpu) => (
        <GpuCard
          key={gpu.id}
          gpu={gpu}
          settings={settings}
          days={days}
          count={counts[gpu.id] ?? 1}
          setCount={(n) => setCounts((c) => ({ ...c, [gpu.id]: n }))}
        />
      ))}
    </div>
  );
}

function GpuCard({
  gpu,
  settings,
  days,
  count,
  setCount,
}: {
  gpu: Gpu;
  settings: Settings;
  days: number;
  count: number;
  setCount: (n: number) => void;
}) {
  // Wszystkie kwoty liczone dla `count` kart przez wybrany okres.
  const mult = days * count;
  const revenue = revenuePerDay(gpu, settings) * mult;
  const prlMined = prlPerDay(gpu, settings) * mult;
  const period = periodLabels(days);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">{gpu.name}</h3>
          {gpu.estimated && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              hashrate szac.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/70">
            Ilość kart
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-white outline-none focus:border-emerald-400/60"
            />
          </label>
          <div className="text-sm text-white/50">
            {ths(gpu.hashrate * count)}
            {count > 1 && <span className="text-white/30"> ({ths(gpu.hashrate)} × {count})</span>}
          </div>
        </div>
      </div>

      {/* Ile karta wykopie w wybranym okresie — niezależnie od kosztu wynajmu */}
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Wykopie {period.long}
          </div>
          <div className="text-2xl font-bold text-emerald-300">{prl(prlMined)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Wartość {period.long}
          </div>
          <div className="text-2xl font-bold text-white">{usd(revenue)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Na godzinę
          </div>
          <div className="text-sm text-white/80">
            {prl((prlPerDay(gpu, settings) / 24) * count)} ·{" "}
            {usd((revenuePerDay(gpu, settings) / 24) * count, 3)}
          </div>
        </div>
        <div className="text-[11px] text-white/40">brutto, bez kosztu wynajmu</div>
        {settings.electricityPricePerKWh > 0 && (
          <div className="text-[11px] text-amber-300/70">
            prąd: −{usd(electricityPerDay(gpu, settings) * mult)}/{period.short} ({gpu.power} W)
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIERS.map((tier) => {
          const row = computeRow(gpu, tier, settings);
          const positive = row.profitPerDay >= 0;
          return (
            <div
              key={tier}
              className={`rounded-lg border p-3 ${
                positive
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-wide ${TIER_TEXT_COLORS[tier]}`}
              >
                {TIER_LABELS[tier]}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {usd(gpu.prices[tier], 3)}/h → koszt {usd(row.totalCostPerDay * mult)}/{period.short}
              </div>
              <div
                className={`mt-2 text-xl font-bold ${
                  positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {usd(row.profitPerDay * mult)}
              </div>
              <div className="text-[11px] text-white/50">
                zysk/{period.short} · ROI {pct(row.roiPercent)}
              </div>
              <div className="text-[11px] text-white/50">
                {usd((row.profitPerDay / 24) * count, 3)}/h
              </div>
              <div className={`text-[11px] ${positive ? "text-emerald-400/80" : "text-red-400/80"}`}>
                ${PROFIT_TARGET_USD} zysku{count > 1 && ` (×${count})`}:{" "}
                {hoursToTarget(row.profitPerDay * count)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type BestSort = "profit" | "roi";

function BestTab({
  gpus,
  settings,
  days,
}: {
  gpus: Gpu[];
  settings: Settings;
  days: number;
}) {
  const period = periodLabels(days);
  const [sortBy, setSortBy] = useState<BestSort>("profit");
  const [tiers, setTiers] = useState<Tier[]>(TIERS);
  const toggleTier = (t: Tier) =>
    setTiers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const rows = useMemo(() => {
    const list = bestOptions(gpus, settings).filter((r) => tiers.includes(r.tier));
    if (sortBy === "roi") list.sort((a, b) => b.roiPercent - a.roiPercent);
    return list;
  }, [gpus, settings, sortBy, tiers]);
  if (gpus.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      <div className="mb-2 flex flex-wrap gap-2">
        <SortButton active={sortBy === "roi"} onClick={() => setSortBy("roi")}>
          Największy ROI
        </SortButton>
        <SortButton active={sortBy === "profit"} onClick={() => setSortBy("profit")}>
          Najwięcej zarobi
        </SortButton>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/50">Priorytet:</span>
        {TIERS.map((t) => (
          <SortButton key={t} active={tiers.includes(t)} onClick={() => toggleTier(t)}>
            <span className={tiers.includes(t) ? TIER_TEXT_COLORS[t] : undefined}>
              {TIER_LABELS[t]}
            </span>
          </SortButton>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-white/50">Zaznacz co najmniej jeden priorytet.</p>
      )}
      <p className="mb-2 text-sm text-white/60">
        {sortBy === "roi"
          ? "Wszystkie karty i priorytety posortowane od najwyższego ROI."
          : `Wszystkie karty i priorytety posortowane od najwyższego zysku ${period.long}.`}
      </p>
      {rows.map((row, i) => {
        const positive = row.profitPerDay >= 0;
        return (
          <div
            key={`${row.gpu.id}-${row.tier}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 py-1 text-sm font-bold text-white/70">
              {i + 1}
            </div>
            <div className="min-w-[9rem] flex-1">
              <div className="font-semibold text-white">
                {row.gpu.name}{" "}
                <span className={`text-xs font-bold uppercase ${TIER_TEXT_COLORS[row.tier]}`}>
                  · {TIER_LABELS[row.tier]}
                </span>
              </div>
              <div className="text-xs text-white/50">
                {ths(row.gpu.hashrate)} · {usd(row.gpu.prices[row.tier], 3)}/h
              </div>
            </div>
            <div className="text-right text-xs text-white/60">
              <div>
                koszt {usd(row.totalCostPerDay * days)}/{period.short}
              </div>
              <div>
                {prl(row.prlPerDay * days)}/{period.short}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-lg font-bold ${
                  positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {usd(row.profitPerDay * days)}
              </div>
              <div className="text-[11px] text-white/50">
                zysk/{period.short} · ROI {pct(row.roiPercent)}
              </div>
              <div className="text-[11px] text-white/50">
                {usd(row.profitPerDay / 24, 3)}/h
              </div>
              <div className={`text-[11px] ${positive ? "text-emerald-400/80" : "text-red-400/80"}`}>
                ${PROFIT_TARGET_USD} zysku: {hoursToTarget(row.profitPerDay)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Moje GPU: wybrane karty × ilość × priorytet ---------- */

interface FleetPick {
  selected: boolean;
  count: number;
  tier: Tier;
}

type Fleet = Record<string, FleetPick>;

const FLEET_STORAGE_KEY = "prl-profit-calculator-fleet-v1";

const FLEET_PERIODS: { label: string; days: number }[] = [
  { label: "Godzina", days: 1 / 24 },
  { label: "Dzień", days: 1 },
  { label: "Tydzień", days: 7 },
  { label: "Miesiąc (30 dni)", days: 30 },
  { label: "Rok (365 dni)", days: 365 },
];

function FleetTab({ gpus, settings }: { gpus: Gpu[]; settings: Settings }) {
  const [fleet, setFleet] = useLocalStorage<Fleet>(FLEET_STORAGE_KEY, {});
  const [calculated, setCalculated] = useState(false);
  const [summaryDays, setSummaryDays] = useState(1);

  if (gpus.length === 0) return <EmptyState />;

  const pickFor = (id: string): FleetPick => fleet[id] ?? { selected: false, count: 1, tier: "lowest" };
  const updatePick = (id: string, patch: Partial<FleetPick>) =>
    setFleet((f) => ({ ...f, [id]: { ...pickFor(id), ...patch } }));

  // Per-day rows; after the first "Oblicz" they follow every change live.
  const lines = calculated
    ? gpus
        .filter((g) => fleet[g.id]?.selected && fleet[g.id].count > 0)
        .map((g) => {
          const pick = fleet[g.id];
          return { count: pick.count, row: computeRow(g, pick.tier, settings) };
        })
    : [];
  const perDay = lines.reduce(
    (acc, { count, row }) => ({
      prl: acc.prl + row.prlPerDay * count,
      revenue: acc.revenue + row.revenuePerDay * count,
      cost: acc.cost + row.totalCostPerDay * count,
      profit: acc.profit + row.profitPerDay * count,
    }),
    { prl: 0, revenue: 0, cost: 0, profit: 0 },
  );
  const totalCards = lines.reduce((n, l) => n + l.count, 0);
  // Weighted average ROI = total profit / total cost.
  const avgRoi = perDay.cost > 0 ? (perDay.profit / perDay.cost) * 100 : 0;
  const summaryPeriod = periodLabels(summaryDays);
  const periods = FLEET_PERIODS.some((p) => p.days === summaryDays)
    ? FLEET_PERIODS
    : [...FLEET_PERIODS, { label: `Twoje: ${summaryPeriod.short}`, days: summaryDays }];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-lg font-semibold text-white">Wybierz karty</h2>
        <p className="mt-1 text-sm text-white/50">
          Zaznacz karty, wpisz ile sztuk i wybierz priorytet Salad, potem kliknij Oblicz.
        </p>
        <div className="mt-3 space-y-2">
          {gpus.map((gpu) => {
            const pick = pickFor(gpu.id);
            return (
              <div
                key={gpu.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                  pick.selected ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10"
                }`}
              >
                <label className="flex min-w-[10rem] flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pick.selected}
                    onChange={(e) => updatePick(gpu.id, { selected: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="font-semibold text-white">{gpu.name}</span>
                  <span className="text-xs text-white/40">{ths(gpu.hashrate)}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  Ilość
                  <input
                    type="number"
                    min={1}
                    value={pick.count}
                    onChange={(e) =>
                      updatePick(gpu.id, {
                        count: Math.max(0, parseInt(e.target.value) || 0),
                        selected: true,
                      })
                    }
                    className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-white outline-none focus:border-emerald-400/60"
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  {TIERS.map((t) => {
                    const profit = computeRow(gpu, t, settings).profitPerDay;
                    return (
                      <SortButton
                        key={t}
                        active={pick.tier === t}
                        onClick={() => updatePick(gpu.id, { tier: t, selected: true })}
                      >
                        <span className={pick.tier === t ? TIER_TEXT_COLORS[t] : undefined}>
                          {TIER_LABELS[t]}
                        </span>
                        <span className="ml-1 text-[11px] text-white/40">
                          {usd(gpu.prices[t], 3)}/h
                        </span>
                        <span
                          className={`block text-[11px] ${
                            profit > 0 ? "text-emerald-400/80" : "text-red-400/80"
                          }`}
                        >
                          ${PROFIT_TARGET_USD} zysku: {hoursToTarget(profit)}
                        </span>
                      </SortButton>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCalculated(true)}
          className="mt-4 rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Oblicz
        </button>
      </section>

      {calculated && lines.length === 0 && (
        <p className="text-sm text-white/50">Nie zaznaczono żadnej karty.</p>
      )}

      {lines.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {/* Wynik: karty, okres, podsumowanie i średni ROI w jednym bloku */}
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
            <h2 className="text-lg font-semibold text-white">Wynik</h2>
            <p className="text-sm text-white/50">
              {totalCards} {totalCards === 1 ? "karta" : "kart"} ·{" "}
              {ths(lines.reduce((h, l) => h + l.row.gpu.hashrate * l.count, 0))} łącznie · razem{" "}
              {summaryPeriod.long}
            </p>

            <div className="mt-3">
              <PeriodPicker days={summaryDays} setDays={setSummaryDays} />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile
                label="Wykopią"
                value={usd(perDay.revenue * summaryDays)}
                sub={`${prl(perDay.prl * summaryDays)} × $${settings.prlPrice} za PRL`}
                tone="text-emerald-300"
              />
              <SummaryTile
                label="Wydasz na GPU"
                value={`−${usd(perDay.cost * summaryDays)}`}
                tone="text-amber-300"
              />
              <SummaryTile
                label="Profit"
                value={usd(perDay.profit * summaryDays)}
                tone={perDay.profit >= 0 ? "text-emerald-400" : "text-red-400"}
                big
              />
              <SummaryTile
                label="Średni ROI"
                value={pct(avgRoi)}
                tone={avgRoi >= 0 ? "text-emerald-400" : "text-red-400"}
                big
              />
            </div>
            <div className="mt-2 text-xs text-white/50">
              Profit = wartość wykopanego PRL − koszt wynajmu GPU · liczone po aktualnej cenie PRL,
              odświeża się razem z ceną
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50">
                  <th className="py-2 pr-3">Okres</th>
                  <th className="py-2 pr-3 text-right">Wykopie</th>
                  <th className="py-2 pr-3 text-right">Koszt wynajmu</th>
                  <th className="py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.label} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-medium text-white">{p.label}</td>
                    <td className="py-2 pr-3 text-right">
                      <div className="font-semibold text-emerald-300">
                        {usd(perDay.revenue * p.days)}
                      </div>
                      <div className="text-[11px] text-white/40">{prl(perDay.prl * p.days)}</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-white/60">
                      −{usd(perDay.cost * p.days)}
                    </td>
                    <td
                      className={`py-2 text-right font-bold ${
                        perDay.profit >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {usd(perDay.profit * p.days)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-white/80">Na kartę ({summaryPeriod.long.replace(/^w /, "za ")})</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/50">
                  <th className="py-2 pr-3">Karta</th>
                  <th className="py-2 pr-3 text-right">Ilość</th>
                  <th className="py-2 pr-3 text-right">Wykopie</th>
                  <th className="py-2 pr-3 text-right">Koszt</th>
                  <th className="py-2 pr-3 text-right">Profit</th>
                  <th className="py-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ count, row }) => (
                  <tr key={row.gpu.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">
                      {row.gpu.name}{" "}
                      <span className={`text-xs font-bold uppercase ${TIER_TEXT_COLORS[row.tier]}`}>
                        · {TIER_LABELS[row.tier]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-white/80">×{count}</td>
                    <td className="py-2 pr-3 text-right">
                      <div className="font-semibold text-emerald-300">
                        {usd(row.revenuePerDay * count * summaryDays)}
                      </div>
                      <div className="text-[11px] text-white/40">{prl(row.prlPerDay * count * summaryDays)}</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-white/60">
                      −{usd(row.totalCostPerDay * count * summaryDays)}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-semibold ${
                        row.profitPerDay >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {usd(row.profitPerDay * count * summaryDays)}
                    </td>
                    <td className="py-2 text-right text-white/70">{pct(row.roiPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {settings.electricityPricePerKWh > 0 && (
            <p className="mt-2 text-xs text-amber-300/70">Koszt zawiera też prąd (Ustawienia).</p>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
  big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</div>
      <div className={`mt-1 font-bold ${big ? "text-2xl" : "text-lg"} ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

function SettingsTab({
  gpus,
  settings,
  setSettings,
  setGpus,
  resetAll,
}: {
  gpus: Gpu[];
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  setGpus: (u: (g: Gpu[]) => Gpu[]) => void;
  resetAll: () => void;
}) {
  const updateGpu = (id: string, patch: Partial<Gpu>) =>
    setGpus((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const updatePrice = (id: string, tier: Tier, value: number) =>
    setGpus((list) =>
      list.map((g) => (g.id === id ? { ...g, prices: { ...g.prices, [tier]: value } } : g)),
    );
  const removeGpu = (id: string) => setGpus((list) => list.filter((g) => g.id !== id));
  const addGpu = () =>
    setGpus((list) => [
      ...list,
      {
        id: `gpu-${Date.now()}`,
        name: "Nowa karta",
        prices: { lowest: 0, low: 0, medium: 0, high: 0 },
        hashrate: 0,
        power: 0,
        estimated: true,
      },
    ]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-lg font-semibold text-white">Rynek PRL i koszty</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledField label="Cena PRL (USD)">
            <NumberInput
              value={settings.prlPrice}
              onChange={(v) => setSettings({ prlPrice: v })}
              step={0.0001}
            />
          </LabeledField>
          <LabeledField label="PRL / TH / dzień">
            <NumberInput
              value={settings.prlPerThPerDay}
              onChange={(v) => setSettings({ prlPerThPerDay: v })}
              step={0.0001}
            />
          </LabeledField>
          <ElectricityField settings={settings} setSettings={setSettings} />
          <LabeledField label="CoinGecko ID (do auto-ceny)">
            <TextInput
              value={settings.coinGeckoId}
              onChange={(v) => setSettings({ coinGeckoId: v })}
              placeholder="np. pearl-2"
            />
          </LabeledField>
        </div>
        <p className="mt-2 text-xs text-white/40">
          Cena prądu = 0 dla Salad (prąd wliczony w wynajem). Ustaw &gt; 0 tylko dla własnego
          sprzętu — koszt = moc karty (W) × 24h × cena/kWh, odejmowany od zysku. Możesz wpisać cenę
          w zł lub $ — przy zł program przelicza po kursie na USD.
        </p>
        <Calibrator settings={settings} setSettings={setSettings} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Karty graficzne</h2>
          <div className="flex gap-2">
            <button
              onClick={addGpu}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/5"
            >
              + Dodaj kartę
            </button>
            <button
              onClick={resetAll}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              Reset do domyślnych
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="p-3">Karta</th>
                <th className="p-3">Hashrate (TH/s)</th>
                <th className="p-3">Moc (W)</th>
                {TIERS.map((t) => (
                  <th key={t} className={`p-3 ${TIER_TEXT_COLORS[t]}`}>
                    {TIER_LABELS[t]} ($/h)
                  </th>
                ))}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {gpus.map((gpu) => (
                <tr key={gpu.id} className="border-t border-white/10">
                  <td className="p-2">
                    <TextInput
                      value={gpu.name}
                      onChange={(v) => updateGpu(gpu.id, { name: v })}
                      className="w-36"
                    />
                  </td>
                  <td className="p-2">
                    <NumberInput
                      value={gpu.hashrate}
                      onChange={(v) => updateGpu(gpu.id, { hashrate: v, estimated: false })}
                      step={1}
                      className="w-28"
                    />
                  </td>
                  <td className="p-2">
                    <NumberInput
                      value={gpu.power}
                      onChange={(v) => updateGpu(gpu.id, { power: v })}
                      step={1}
                      className="w-24"
                    />
                  </td>
                  {TIERS.map((t) => (
                    <td key={t} className="p-2">
                      <NumberInput
                        value={gpu.prices[t]}
                        onChange={(v) => updatePrice(gpu.id, t, v)}
                        step={0.001}
                        className="w-24"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    <button
                      onClick={() => removeGpu(gpu.id)}
                      className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Calibrator({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Update one network parameter and recompute the derived PRL/TH/day factor.
  const setNet = (patch: Partial<Settings>) => {
    const merged = { ...settings, ...patch };
    const factor = factorFromNetwork(
      merged.networkHashrateThs,
      merged.blockRewardPrl,
      merged.blockTimeSec,
    );
    setSettings({ ...patch, prlPerThPerDay: factor });
  };

  // Fetch live network stats from the pool and fill all fields.
  const refreshNetwork = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(settings.statsUrl);
      const d = await res.json();
      const netHashps: number = d?.network?.networkHashps;
      const difficulty: number = d?.network?.difficulty ?? settings.networkDifficulty;
      const coinUnits: number = d?.config?.coinUnits ?? 1e8;
      const blockTime: number =
        d?.network?.difficultyTarget ?? d?.config?.coinDifficultyTarget ?? 194;
      const rewardPRL = Number(d?.lastblock?.reward) / coinUnits;
      if (!netHashps || !rewardPRL || !blockTime) {
        setMsg("Nie udało się odczytać danych sieci z tego adresu.");
        return;
      }
      const netHashThs = netHashps / 1e12;
      const factor = factorFromNetwork(netHashThs, rewardPRL, blockTime);
      setSettings({
        networkDifficulty: difficulty,
        networkHashrateThs: netHashThs,
        blockRewardPrl: rewardPRL,
        blockTimeSec: blockTime,
        prlPerThPerDay: factor,
      });
      setMsg(`Odświeżono z sieci. Uzysk: ${factor.toFixed(6)} PRL/TH/dzień.`);
    } catch {
      setMsg("Błąd pobierania danych sieci (sieć/CORS). Możesz wpisać wartości ręcznie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-white/80">Dane sieci PRL (uzysk)</div>
        <button
          onClick={refreshNetwork}
          disabled={busy}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Odświeżam…" : "Odśwież dane sieci"}
        </button>
      </div>
      <p className="mt-2 text-xs text-white/50">
        Kliknij „Odśwież dane sieci", aby pobrać aktualne wartości z puli, albo wpisz je ręcznie.
        Uzysk (PRL/TH/dzień) liczy się z nich sam: nagroda × 86400 ÷ (czas bloku × hashrate sieci).
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LabeledField label="Trudność sieci">
          <NumberInput
            value={settings.networkDifficulty}
            onChange={(v) => setNet({ networkDifficulty: v })}
            step={1}
          />
        </LabeledField>
        <LabeledField label="Hashrate sieci (TH/s)">
          <NumberInput
            value={settings.networkHashrateThs}
            onChange={(v) => setNet({ networkHashrateThs: v })}
            step={1}
          />
        </LabeledField>
        <LabeledField label="Nagroda / blok (PRL)">
          <NumberInput
            value={settings.blockRewardPrl}
            onChange={(v) => setNet({ blockRewardPrl: v })}
            step={0.01}
          />
        </LabeledField>
        <LabeledField label="Czas bloku (s)">
          <NumberInput
            value={settings.blockTimeSec}
            onChange={(v) => setNet({ blockTimeSec: v })}
            step={0.01}
          />
        </LabeledField>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <LabeledField label="Uzysk PRL / TH / dzień (można nadpisać)">
          <NumberInput
            value={settings.prlPerThPerDay}
            onChange={(v) => setSettings({ prlPerThPerDay: v })}
            step={0.0001}
            className="w-40"
          />
        </LabeledField>
      </div>
      {msg && <div className="mt-2 text-xs text-emerald-300/90">{msg}</div>}

      <div className="mt-3">
        <LabeledField label="Adres danych sieci (pool stats API)">
          <TextInput
            value={settings.statsUrl}
            onChange={(v) => setSettings({ statsUrl: v })}
            className="w-full max-w-xl"
          />
        </LabeledField>
      </div>
    </div>
  );
}

function ElectricityField({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isPln = settings.electricityCurrency === "PLN";

  const fetchRate = async () => {
    setBusy(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const d = await res.json();
      const pln = d?.rates?.PLN;
      if (typeof pln === "number") setSettings({ usdPlnRate: pln });
    } catch {
      /* keep manual rate */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">
        Cena prądu / kWh
      </span>
      <div className="flex gap-2">
        <select
          value={settings.electricityCurrency}
          onChange={(e) =>
            setSettings({ electricityCurrency: e.target.value as "USD" | "PLN" })
          }
          className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
        >
          <option value="USD">$</option>
          <option value="PLN">zł</option>
        </select>
        <NumberInput
          value={settings.electricityPricePerKWh}
          onChange={(v) => setSettings({ electricityPricePerKWh: v })}
          step={0.01}
          className="w-full"
        />
      </div>
      {isPln && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
          <span>kurs zł/$:</span>
          <NumberInput
            value={settings.usdPlnRate}
            onChange={(v) => setSettings({ usdPlnRate: v })}
            step={0.01}
            className="w-20"
          />
          <button
            onClick={fetchRate}
            disabled={busy}
            className="rounded border border-white/15 px-2 py-1 text-white/70 hover:bg-white/5 disabled:opacity-50"
          >
            {busy ? "…" : "pobierz kurs"}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/50">
      Brak kart. Dodaj kartę w zakładce Ustawienia.
    </div>
  );
}

/* ---------- small UI primitives ---------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium transition ${
        active ? "text-white" : "text-white/50 hover:text-white/80"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-400" />
      )}
    </button>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className={`rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60 ${className}`}
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60 ${className}`}
    />
  );
}
