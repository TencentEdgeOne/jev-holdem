export const MODEL = "@makers/jev";

export const QUESTIONS = {
  made_hand_strength: {
    type: "score",
    instructions:
      "How strong is hero's current made hand on this board, ignoring draws? Use `hero.made_hand`, `hero.hole_cards`, and `board`.",
    criteria: [
      "Air: high card or no showdown value",
      "Weak: low pair, weak kicker, or very fragile one pair",
      "Medium: top pair weak kicker, second pair, or decent showdown value",
      "Strong: top pair good kicker, overpair, two pair, or better",
      "Nuts-level: set, straight, flush, full house, quads, or the actual nuts",
    ],
  },
  draw_equity: {
    type: "score",
    instructions:
      "How much extra equity do hero's draws add beyond the made hand? Use `hero.draws` and remaining streets in `street`.",
    criteria: [
      "No meaningful draw",
      "Weak draw only (gutshot or backdoor)",
      "Strong draw (open-ended straight draw or flush draw)",
      "Combo draw or almost certain to improve",
    ],
  },
  board_danger: {
    type: "score",
    instructions:
      "How coordinated and dangerous is `board` against a typical heads-up calling range?",
    criteria: [
      "Dry and disconnected; few strong made hands possible",
      "Somewhat coordinated; one-pair hands are a bit nervous",
      "Very wet: straight and flush possibilities, scary for one pair",
    ],
  },
  fold_to_price: {
    type: "noul",
    instructions:
      "Given `betting.pot_odds`, `betting.to_call`, `hero.made_hand`, and `hero.draws`, should hero fold rather than continue?",
    criteria: {
      true: "The price is too high for this holding; folding is clearly best",
      false: "Continuing (check, call, bet, or raise) is reasonable",
    },
  },
  value_bet: {
    type: "noul",
    instructions:
      "Is this a good spot for hero to bet or raise for value?",
    criteria: {
      true: "Hero is ahead of hands that can call often enough to bet or raise for value",
      false: "A value bet or raise is not justified",
    },
  },
  bluff: {
    type: "noul",
    instructions:
      "Is this a good spot for hero to bluff (bet or raise with a weak made hand)?",
    criteria: {
      true: "Board, history, and fold equity make a bluff attractive",
      false: "Bluffing is not attractive here",
    },
  },
  trap: {
    type: "noul",
    instructions:
      "Should hero check a strong hand to induce a bet (slowplay / trap)?",
    criteria: {
      true: "Checking with a strong hand is better than betting now",
      false: "Do not slowplay; betting or raising is better if the hand is strong",
    },
  },
  line: {
    type: "choice",
    instructions:
      "Which line best fits a winning heads-up no-limit hold'em strategy for hero on this decision? Only pick an action listed in `betting.legal_actions`.",
    criteria: {
      fold: "Give up the pot",
      check: "Check; put no more chips in",
      call: "Call the current bet",
      bet: "Bet (the pot has not been bet yet this street)",
      raise: "Raise the current bet",
      allin: "Move all-in",
    },
  },
  bet_size: {
    type: "choice",
    instructions:
      "If hero bets or raises, which size is most appropriate given `betting.pot`, `betting.to_call`, `hero.stack`, and `betting.spr`?",
    criteria: {
      small: "About one-third pot, or the minimum raise",
      medium: "About two-thirds to three-quarters pot",
      large: "About pot, or a large overbet",
      all_in: "Shove all remaining chips",
    },
  },
};

export const THRESHOLDS = {
  foldNoul: 0.78,
  valueBetNoul: 0.62,
  bluffNoul: 0.7,
  trapNoul: 0.75,
  strongMadeScore: 3.15,
  nutsMadeScore: 3.7,
  lineConfidenceMin: 0.42,
  allInSpr: 1.2,
};
