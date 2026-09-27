# Kalkulator zysku — PRL na Salad

Aplikacja webowa, która liczy dzienny **zysk z kopania Pearl (PRL)** na kartach GPU wynajmowanych
na [Salad](https://salad.com/). Dla każdej karty i każdego priorytetu cenowego Salad (lowest / low /
medium / high) pokazuje koszt wynajmu, ilość wykopanego PRL, przychód i **zysk na dobę**, oraz
ranking „Najlepsze opcje".

## Co liczy

Dla każdej karty × priorytet:

- **Koszt / dzień** = cena `$/h` × 24
- **PRL / dzień** = `hashrate (TH/s)` × `PRL/TH/dzień`
- **Przychód / dzień** = `PRL/dzień` × `cena PRL (USD)`
- **Zysk / dzień** = przychód − koszt (oraz ROI %)

Zakładka **Najlepsze opcje** pokazuje wszystkie kombinacje karta+priorytet posortowane od
najwyższego zysku.

## Edytowalne dane (zakładka Ustawienia)

Wszystko jest edytowalne i zapisuje się w przeglądarce (localStorage):

- **Cena PRL (USD)** — wpisz ręcznie lub pobierz przyciskiem „Odśwież cenę" (podaj CoinGecko ID).
- **PRL / TH / dzień** — współczynnik zarobku. Użyj **Kalibratora**: wpisz z herominers/WhatToMine
  ile PRL/dobę daje karta o danym hashrate, a on wyliczy współczynnik.
- **Karty GPU** — nazwa, hashrate (TH/s) i 4 ceny wynajmu. Możesz dodawać/usuwać karty.

Hashrate (pearlhash):
- Podane przez Ciebie: RTX 5080 = 223, RTX 4090 = 288, RTX 5070 = 124 TH/s.
- Pozostałe z benchmarków SRBMiner (hashrate.no, wrzesień 2026): RTX 5090 = 417.9,
  RTX 5070 Ti = 170.5, RTX 5060 Ti = 87.3, RTX 5060 = 72.2, RTX 3090 Ti = 121.4 TH/s.

Cena PRL pobierana jest z CoinGecko (`pearl-2`) — przycisk „Odśwież cenę". Domyślny współczynnik
`PRL/TH/dzień = 0.0407` pochodzi z benchmarku (4.94 PRL/dobę przy 121.35 TH/s); trudność sieci
zmienia się codziennie, więc skalibruj go pod aktualny uzysk (Kalibrator w Ustawieniach).

## Uruchomienie lokalnie

Wymagany Node 18+.

```bash
npm install
npm run dev
```

Aplikacja wystartuje na `http://localhost:43217`.

Build produkcyjny:

```bash
npm run build
npm run preview
```

## Stack

Vite + React + TypeScript + Tailwind CSS. Bez backendu — wszystko liczone w przeglądarce.
