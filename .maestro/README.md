# E2E tests — Maestro

End-to-end UI tests for RepLog, one flow per real user journey (the same ones
walked during the UX review). Maestro drives the **real app** on an Android
emulator/device via plain-YAML flows.

## How E2E works here

- **Tool:** [Maestro](https://maestro.mobile.dev) — chosen in the Build Plan (§5.3). YAML flows, no native test code, resilient selectors (matches visible text). Alternatives considered: Detox (heavier, native gray-box) and Jest+RNTL (component/integration, already used for the 72 unit tests — not true E2E).
- **What runs:** Maestro launches `com.replog.app`, taps/types/asserts against on-screen Spanish text (sourced from `src/i18n/es.json`), and fails if a screen/element is missing.
- **Selectors:** visible copy (e.g. `"Empezar entreno"`, `"Siguiente ejercicio"`) and regexes for dynamic text (e.g. `"Ejercicio .* de .*"`).

## Prerequisites

1. Android emulator running **or** a device (`adb devices` shows it).
2. The app installed and reachable:
   - Dev client + Metro: `npx expo start --dev-client` and launch once, **or**
   - A standalone build: `npx expo run:android`.
3. Maestro CLI:
   ```bash
   curl -Ls https://get.maestro.mobile.dev | bash
   ```
4. A test account that exists on the Supabase project (the app forces login).
   Pass it at run time (see below) or rely on a cached session.

## Run

```bash
# All flows
maestro test .maestro

# A single flow
maestro test .maestro/flows/03-start-and-log-session.yaml

# With explicit credentials (override config.yaml defaults)
maestro test -e EMAIL=you@example.com -e PASSWORD=secret .maestro

# Interactive selector inspector (great for fixing a flaky tap)
maestro studio
```

`pnpm test:e2e` is wired to `maestro test .maestro`.

## Flows

| File | Journey |
|---|---|
| `flows/01-auth.yaml` | Launch → sign in → land on the tabs |
| `flows/02-home-navigation.yaml` | Home state + walking the 4 bottom tabs |
| `flows/03-start-and-log-session.yaml` | Core loop: start/resume → log set → +Serie/Duplicar/Al fallo → Siguiente → Finalizar → summary |
| `flows/04-routines-and-editor.yaml` | Weekly plan + routine list → editor → exercise picker |
| `flows/05-catalog-search-filter.yaml` | Catalog: filter by muscle group + text search |
| `flows/06-history.yaml` | History list + open a session detail |
| `flows/07-settings.yaml` | Unit toggle + failure metric + profile section |
| `flows/08-retroactive-logging.yaml` | Reach the past-dated workout screen |
| `subflows/ensure-logged-in.yaml` | Shared: launch + sign in if the login gate shows |

## Status / caveats

- These flows are **authored from the real running app** (selectors verified against the live UI and `es.json`) but were **not yet executed green end-to-end** — the review emulator was resource-starved (system ANR). Run them on a healthy emulator/device and adjust any selector that drifted (use `maestro studio`).
- `01-auth` assumes the test account already exists; first run may need a manual sign-up, or extend the flow to tap **"Registrarme"**.
- Once `app/_layout.tsx` adopts the local-anonymous identity (TKT for defer-auth), the login step in `ensure-logged-in` becomes optional — guard it with `when: visible: "Iniciar sesión"` (already done).
