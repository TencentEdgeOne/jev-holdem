# Jev Hold'em

Heads-up no-limit Texas hold'em against TypeSafe **Jev**. A local engine deals the cards, ranks hands, computes pot odds, and enforces legal actions. Jev only answers a fixed set of typed questions (Choice / Score / Noul); application code turns those answers into a bet.

## Deploy

[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?from=github&template=jev-holdem)

More Templates: [EdgeOne Pages](https://edgeone.ai/pages/templates)

## Overview

Opening the page starts a match. You play as Hero; Jev sits across the table. Each time it is Jev's turn, the frontend posts one SystemOne request with the current table state. That decision is served by the `@makers/jev` model on EdgeOne Makers Models.

If the API is unavailable, a local heuristic still picks a legal action so the hand can continue.

## Features

- **Heads-up no-limit hold'em** — blinds, streets, raise sizing, all-in, showdown, and side-pot-free chip accounting in a two-player match
- **Typed Jev decisions** — one `@makers/jev` call per action; no chat, no SDK
- **Policy layer** — if the Choice line is confident enough it is used directly; otherwise Score / Noul answers are composed into fold / check / call / bet / raise / all-in
- **Model is injected** — EdgeOne Makers Models supplies `@makers/jev` automatically, and `edge-functions/typesafe/[[default]].js` uses it for this match
- **Mobile-first table** — sticky action bar in portrait, side panel on the right in landscape and on desktop
- **Fallback play** — API errors fall back to a category-based heuristic instead of stalling the hand

## How Decisions Work

Questions and thresholds live in `src/jev/questions.js`. One request covers:

| Question | Type | Role |
|----------|------|------|
| `made_hand_strength` | Score | Strength of the made hand, ignoring draws |
| `draw_equity` | Score | Extra equity from draws |
| `board_danger` | Score | How coordinated the board is |
| `fold_to_price` | Noul | Whether the price is too high to continue |
| `value_bet` | Noul | Whether to bet or raise for value |
| `bluff` | Noul | Whether a bluff is attractive |
| `trap` | Noul | Whether to check a strong hand |
| `line` | Choice | fold / check / call / bet / raise / all-in |
| `bet_size` | Choice | small / medium / large / all_in |

`src/jev/policy.js` maps answers onto `getLegal()` output. `@makers/jev` is injected automatically by EdgeOne Makers Models. The only HTTP call is `POST /typesafe/v1/systemone`.

## Project Structure

```
jev-holdem/
├── index.html
├── edgeone.json                         # EdgeOne Pages output directory: dist/
├── edge-functions/
│   └── typesafe/
│       └── [[default]].js               # Jev decision for this match
└── src/
    ├── main.js                          # Match loop, player input, Jev turn
    ├── ui.js                            # Table, controls, Jev panel
    ├── style.css
    ├── poker/
    │   ├── cards.js                     # Deck, suits, ranks
    │   ├── hand.js                      # 5-card evaluation
    │   ├── facts.js                     # Made hand + draws + pot odds
    │   └── engine.js                    # Table, streets, legal actions
    └── jev/
        ├── questions.js                 # SystemOne questions + thresholds
        ├── policy.js                    # Answers → legal action
        └── client.js                    # fetch + retry
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL |
| `AI_GATEWAY_API_KEY` | Yes | Gateway API key |

## Learn More

- [EdgeOne Pages](https://pages.edgeone.ai)
- [EdgeOne Pages Functions](https://pages.edgeone.ai/document/pages-functions-overview)
- [Vite](https://vite.dev)
- [TypeSafe](https://typesafe.ai)
- [TypeSafe docs](https://docs.typesafe.ai)
