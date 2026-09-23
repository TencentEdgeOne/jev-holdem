const MODEL = "@makers/jev";

const QUESTIONS = {
  "made_hand_strength": {
    "type": "score",
    "instructions": "How strong is hero's current made hand on this board, ignoring draws? Use `hero.made_hand`, `hero.hole_cards`, and `board`.",
    "criteria": [
      "Air: high card or no showdown value",
      "Weak: low pair, weak kicker, or very fragile one pair",
      "Medium: top pair weak kicker, second pair, or decent showdown value",
      "Strong: top pair good kicker, overpair, two pair, or better",
      "Nuts-level: set, straight, flush, full house, quads, or the actual nuts"
    ]
  },
  "draw_equity": {
    "type": "score",
    "instructions": "How much extra equity do hero's draws add beyond the made hand? Use `hero.draws` and remaining streets in `street`.",
    "criteria": [
      "No meaningful draw",
      "Weak draw only (gutshot or backdoor)",
      "Strong draw (open-ended straight draw or flush draw)",
      "Combo draw or almost certain to improve"
    ]
  },
  "board_danger": {
    "type": "score",
    "instructions": "How coordinated and dangerous is `board` against a typical heads-up calling range?",
    "criteria": [
      "Dry and disconnected; few strong made hands possible",
      "Somewhat coordinated; one-pair hands are a bit nervous",
      "Very wet: straight and flush possibilities, scary for one pair"
    ]
  },
  "fold_to_price": {
    "type": "noul",
    "instructions": "Given `betting.pot_odds`, `betting.to_call`, `hero.made_hand`, and `hero.draws`, should hero fold rather than continue?",
    "criteria": {
      "true": "The price is too high for this holding; folding is clearly best",
      "false": "Continuing (check, call, bet, or raise) is reasonable"
    }
  },
  "value_bet": {
    "type": "noul",
    "instructions": "Is this a good spot for hero to bet or raise for value?",
    "criteria": {
      "true": "Hero is ahead of hands that can call often enough to bet or raise for value",
      "false": "A value bet or raise is not justified"
    }
  },
  "bluff": {
    "type": "noul",
    "instructions": "Is this a good spot for hero to bluff (bet or raise with a weak made hand)?",
    "criteria": {
      "true": "Board, history, and fold equity make a bluff attractive",
      "false": "Bluffing is not attractive here"
    }
  },
  "trap": {
    "type": "noul",
    "instructions": "Should hero check a strong hand to induce a bet (slowplay / trap)?",
    "criteria": {
      "true": "Checking with a strong hand is better than betting now",
      "false": "Do not slowplay; betting or raising is better if the hand is strong"
    }
  },
  "line": {
    "type": "choice",
    "instructions": "Which line best fits a winning heads-up no-limit hold'em strategy for hero on this decision? Only pick an action listed in `betting.legal_actions`.",
    "criteria": {
      "fold": "Give up the pot",
      "check": "Check; put no more chips in",
      "call": "Call the current bet",
      "bet": "Bet (the pot has not been bet yet this street)",
      "raise": "Raise the current bet",
      "allin": "Move all-in"
    }
  },
  "bet_size": {
    "type": "choice",
    "instructions": "If hero bets or raises, which size is most appropriate given `betting.pot`, `betting.to_call`, `hero.stack`, and `betting.spr`?",
    "criteria": {
      "small": "About one-third pot, or the minimum raise",
      "medium": "About two-thirds to three-quarters pot",
      "large": "About pot, or a large overbet",
      "all_in": "Shove all remaining chips"
    }
  }
};

const VARIANT =
  "Heads-up no-limit Texas hold'em. Hero is Jev, the decision-maker. Villain hole cards are hidden.";
const BOARD_BY_STREET = { preflop: 0, flop: 3, turn: 4, river: 5 };
const POSITIONS = new Set(["button / small blind", "big blind"]);
const ACTIONS = ["fold", "check", "call", "bet", "raise", "allin"];
const CARD = /^[2-9TJQKA][cdhs]$/;

function fail(message) {
  return { error: message };
}

function shortText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

function chips(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
    return null;
  }
  return value;
}

function cards(value, count) {
  if (!Array.isArray(value) || value.length !== count) return null;
  if (!value.every((code) => typeof code === "string" && CARD.test(code))) return null;
  if (new Set(value).size !== value.length) return null;
  return value;
}

export function buildHoldemRequest(payload) {
  const state = payload && typeof payload === "object" ? payload.state : null;
  if (!state || typeof state !== "object" || Array.isArray(state)) return fail("需要当前牌局状态");
  if (state.variant !== VARIANT) return fail("只接受单挑无限德州");

  const street = state.street;
  if (!Object.prototype.hasOwnProperty.call(BOARD_BY_STREET, street)) return fail("街道无效");

  const hero = state.hero;
  const villain = state.villain;
  const betting = state.betting;
  if (!hero || !villain || !betting) return fail("牌桌字段不完整");
  if (villain.hole_cards || villain.made_hand) return fail("不能提交对手底牌");
  if (!POSITIONS.has(hero.position) || !POSITIONS.has(villain.position) || hero.position === villain.position) {
    return fail("位置无效");
  }

  const hole = cards(hero.hole_cards, 2);
  if (!hole) return fail("底牌无效");
  const madeHand = shortText(hero.made_hand, 80);
  if (!madeHand) return fail("成牌描述无效");
  if (!Array.isArray(hero.draws) || hero.draws.length < 1 || hero.draws.length > 6) return fail("听牌无效");
  const draws = [];
  for (const draw of hero.draws) {
    const text = shortText(draw, 40);
    if (!text) return fail("听牌无效");
    draws.push(text);
  }

  const heroStack = chips(hero.stack);
  const villainStack = chips(villain.stack);
  if (heroStack == null || villainStack == null) return fail("筹码无效");
  const lastAction = shortText(villain.last_action, 80);
  if (!lastAction) return fail("对手动作无效");

  let board;
  if (street === "preflop") {
    if (state.board !== "preflop, no board yet") return fail("翻牌前没有公共牌");
    board = state.board;
  } else {
    board = cards(state.board, BOARD_BY_STREET[street]);
    if (!board) return fail("公共牌无效");
    if (board.some((code) => hole.includes(code))) return fail("公共牌与底牌重复");
  }

  const legal = betting.legal_actions;
  if (!Array.isArray(legal) || legal.length < 1 || legal.length > ACTIONS.length) return fail("合法动作无效");
  if (new Set(legal).size !== legal.length || legal.some((action) => !ACTIONS.includes(action))) {
    return fail("合法动作无效");
  }

  const potOdds = shortText(betting.pot_odds, 24);
  const equity = betting.equity_needed_percent;
  if (!potOdds) return fail("底池赔率无效");
  if (typeof equity !== "number" || !Number.isFinite(equity) || equity < 0 || equity > 100) {
    return fail("所需胜率无效");
  }

  const numeric = ["pot", "current_bet", "to_call", "spr", "min_bet", "min_raise_to", "max_to"];
  const amounts = {};
  for (const key of numeric) {
    const value = chips(betting[key]);
    if (value == null) return fail("下注数字无效");
    amounts[key] = value;
  }

  if (!Array.isArray(state.action_history) || state.action_history.length > 48) return fail("行动记录无效");
  const history = [];
  for (const line of state.action_history) {
    const text = shortText(line, 160);
    if (!text) return fail("行动记录无效");
    history.push(text);
  }

  return {
    body: {
      model: MODEL,
      questions: QUESTIONS,
      state: {
        variant: VARIANT,
        street,
        hero: {
          position: hero.position,
          stack: heroStack,
          hole_cards: hole,
          made_hand: madeHand,
          draws,
        },
        villain: {
          position: villain.position,
          stack: villainStack,
          last_action: lastAction,
        },
        board,
        betting: {
          pot: amounts.pot,
          current_bet: amounts.current_bet,
          to_call: amounts.to_call,
          pot_odds: potOdds,
          equity_needed_percent: equity,
          spr: amounts.spr,
          min_bet: amounts.min_bet,
          min_raise_to: amounts.min_raise_to,
          max_to: amounts.max_to,
          legal_actions: legal,
        },
        action_history: history,
      },
    },
  };
}
