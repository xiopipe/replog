# Discussion & Decisions

Log of the spec interview. Each round records decisions and open questions.

## Initial context
Mobile app to track strength workouts (hypertrophy): weights, sessions, programming, reps, proximity to failure. Set-by-set logging (exercise, weight, reps, proximity to failure). Goal: week-over-week tracking. Tentative stack: React Native, Android first, own API, likely Postgres, possibly offline.

## Base concepts
- **RIR** (Reps In Reserve): reps left in the tank (0 = failure).
- **RPE** (Rate of Perceived Exertion): effort 1–10. RPE 8 ≈ 2 RIR.

## Round 1 — Foundations
| Decision | Choice |
|---|---|
| User (MVP) | Multi-user from day 1 (login, per-user isolated data) |
| Failure metric | Both RIR and RPE, configurable per set |
| Main flow | Hybrid: template routines + improvise/modify on the fly |
| Offline | Offline-first |

## Round 2 — Training model and programming
| Decision | Choice |
|---|---|
| Exercise catalog | Predefined + custom |
| Progression scope (MVP) | Log only; programming/periodization later |
| Model scalability | CRITICAL: must support future advanced programming and an LLM consuming the records (RIR/RPE, weight, reps, sets, rests, nutrition) |
| In-session flexibility | Swap/change exercise mid-session |

## Round 3 — MVP scope
| Decision | Choice |
|---|---|
| Exercise types (MVP) | Gym exercises (free weights, machines). Each set logs weight + reps + RIR/RPE |
| MVP scope | Capture + simple history |
| Units | kg and lb configurable |
| In-session substitution | Add/remove exercises freely |

## Round 4 — Tech stack
| Decision | Choice |
|---|---|
| Backend | Supabase (managed Postgres + auth + APIs) |
| Language | TypeScript across the stack |
| App | React Native + Expo (managed), Android first |
| Auth | Email/password + Google |

## Round 5 — Refining the model
| Topic | Decision |
|---|---|
| Weight storage | Strategy C: store typed value (`weight_value`+`weight_unit`) and normalized `weight_kg` |
| Offline-first | Legend-State + Supabase sync plugin (library only, no separate server) |
| Supersets/dropsets | Modeled from the start (superset on `session_exercises`, dropset on `sets`) |
| Auth + offline | First login online, then cached session allows offline entry |

## Round 6 — Exercise catalog
| Topic | Decision |
|---|---|
| Catalog source | Curated list (~60) + custom |
| Muscle taxonomy | Simple, 8 groups: chest, back, shoulders, arms, quads, hamstrings_glutes, calves, core |

## Round 7 — More product
| Topic | Decision |
|---|---|
| Templates in MVP | Minimal: "repeat last" and "duplicate previous session" |
| Retroactive logging | Yes: past-dated workouts (`started_at` editable) and edit saved sets |
| Bodyweight + load | For `is_bodyweight`: log reps + added load as "the weight"; bodyweight not added |

## Round 8 — Preliminary UX
| Topic | Decision |
|---|---|
| Rest timer | Not in the MVP (manual `rest_seconds`; timer with alert later) |
| PR detection | Yes in MVP: compare to local history; celebrate record |

## Round 9 — Navigation and screens
| Topic | Decision |
|---|---|
| Navigation | Bottom tab bar: Home · Routines · History · Settings |
| Home | Action-focused: "Start workout", resume, repeat last |
| Set logging | Inline editable row (weight · reps · RIR/RPE · ✓) |

## Round 10 — Session flow redesign
| Topic | Decision |
|---|---|
| Session flow | Focused walkthrough: one exercise at a time, "Next exercise" (slide) |
| Per-exercise timing | Automatic: `started_at`/`ended_at` on `session_exercises` |
| Add exercise | Secondary action (⋮ menu) |
| Tab bar | Hidden during active session |

## Round 11 — Routine planning (into MVP)
| Topic | Decision |
|---|---|
| Planning | First-class in MVP: day routines + weekly plan |
| Day binding | Both/configurable: `plan_days.weekday` nullable (fixed or flexible) |

## Round 12 — More screens (UX)
| Topic | Decision |
|---|---|
| Tabs | Home · Routines · History · Settings (former "Exercises" → "Routines") |
| Editor | Reorderable exercises with target sets×reps |
| History | Sessions grouped by week with day, duration, sets, PR badge |

## Round 13 — Data strategy for the LLM (hypertrophy)
| Topic | Decision |
|---|---|
| Training goal | Hypertrophy, fixed |
| Per-muscle volume | Fractional, via `exercise_muscles` (primary 1.0, secondary 0.5) |
| User context (profile) | Capture experience level, available days, equipment, priority muscles, injuries |
| Manual recovery signal | Not for now (automatic signals only) |
| Target reps | Model stores what's prescribed (`target_reps_min`/`max`); no default |
| PR / 1RM | No real 1RM testing; estimated 1RM + rep-PRs = signal |

## Round 14 — New-user journey
| Topic | Decision |
|---|---|
| Onboarding | Minimal: sign up and into the app; optional profile context from Settings |
| First plan | Both: starter template (cloned) or blank |
| Rest days | Implicit (day with no routine = rest) |
| Session close | Session summary (duration, sets/exercises, sets per muscle, PRs) |

## Round 15 — Language, exercise media, and scope
| Topic | Decision |
|---|---|
| Language / i18n | Spanish default, i18n from day 1 (externalized text) |
| Exercise media | Muscle figure from `exercise_muscles` (no external images) |
| Instruction | Short instruction (1–2 sentences) per exercise |
| Multiple plans | No (out of scope) |
| Push reminders | No; future idea: in-app celebrations/achievements |

## Round 16 — PR definition and history summary
| Topic | Decision |
|---|---|
| PR definition | Estimated 1RM (Epley/Brzycki) or rep-PR |
| Warm-ups | Always excluded from volume and PRs (`is_warmup`) |
| History session summary | Sets per muscle group |

## Round 17 — Name and mockups
| Topic | Decision |
|---|---|
| App name | RepLog |
| Mockups | Generated in SVG, stored in the vault and embedded |

## Round 18 — SQL schema
| Topic | Decision |
|---|---|
| Deliverable | Full SQL schema + catalog seed (`sql/`) |
| Tech decisions | Client uuid PKs; `updated_at` trigger; soft delete; denormalized `user_id`; per-user RLS with read-only global exercises; `profiles` auto-created by trigger |

## Round 19 — Build Plan
| Topic | Decision |
|---|---|
| Executor | Claude Code in a fresh repo. Deliverable: `Build-Plan.md` + `CLAUDE.md` |
| Source of truth | The vault specs; the repo keeps them in `/docs` |

## Round 20 — Repo in English
| Topic | Decision |
|---|---|
| Repo language | Everything in the repo in English (code, comments, specs, toolkit, SQL comments, catalog names, muscle slugs, wireframe text) |
| App language | Stays Spanish-default via i18n |
