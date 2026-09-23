import { makeDeck, shuffle } from "./cards.js";
import { bestOf, compareHands, nameHand, nameHandZh } from "./hand.js";
import { describeHolding, potOdds } from "./facts.js";

const IDS = ["hero", "jev"];

function otherId(id) {
  return id === "hero" ? "jev" : "hero";
}

function makePlayer(id, stack) {
  return {
    id,
    stack,
    hole: [],
    folded: false,
    allIn: false,
    betStreet: 0,
    committed: 0,
    hasActed: false,
    lastAction: null,
  };
}

export function createTable({
  smallBlind = 10,
  bigBlind = 20,
  startingStack = 1000,
} = {}) {
  return {
    smallBlind,
    bigBlind,
    startingStack,
    players: {
      hero: makePlayer("hero", startingStack),
      jev: makePlayer("jev", startingStack),
    },
    button: "hero",
    street: "idle",
    board: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    lastRaiseSize: 0,
    toAct: null,
    events: [],
    winner: null,
    showdown: false,
    revealed: false,
    handNumber: 0,
    matchOver: null,
  };
}

export function resetMatch(table) {
  table.players.hero = makePlayer("hero", table.startingStack);
  table.players.jev = makePlayer("jev", table.startingStack);
  table.button = "hero";
  table.street = "idle";
  table.board = [];
  table.pot = 0;
  table.toAct = null;
  table.events = [];
  table.winner = null;
  table.showdown = false;
  table.revealed = false;
  table.handNumber = 0;
  table.matchOver = null;
}

function living(table) {
  return IDS.map((id) => table.players[id]).filter((p) => !p.folded);
}

function bbId(table) {
  return otherId(table.button);
}

function actionOrder(table) {
  if (table.street === "preflop") return [table.button, bbId(table)];
  return [bbId(table), table.button];
}

function putChips(table, player, amount) {
  const pay = Math.min(amount, player.stack);
  player.stack -= pay;
  player.betStreet += pay;
  player.committed += pay;
  table.pot += pay;
  if (player.stack === 0) player.allIn = true;
  return pay;
}

function returnUncalled(table) {
  const [a, b] = IDS.map((id) => table.players[id]);
  if (a.folded || b.folded) return;
  if (a.committed === b.committed) return;
  const high = a.committed > b.committed ? a : b;
  const low = high === a ? b : a;
  const diff = high.committed - low.committed;
  high.committed -= diff;
  high.stack += diff;
  if (high.betStreet >= diff) high.betStreet -= diff;
  table.pot -= diff;
  if (high.stack > 0) high.allIn = false;
}

function dealTo(table, n) {
  for (let i = 0; i < n; i++) table.board.push(table.deck.pop());
}

function bettingDone(table) {
  const live = living(table);
  if (live.length < 2) return true;
  const active = live.filter((p) => !p.allIn);
  if (active.length === 0) return true;
  if (active.length === 1) {
    const a = active[0];
    const o = live.find((p) => p.id !== a.id);
    return a.hasActed && a.betStreet >= o.betStreet;
  }
  return active.every((p) => p.hasActed && p.betStreet === table.currentBet);
}

function nextToAct(table, afterId) {
  const order = actionOrder(table);
  const start = afterId ? order.indexOf(afterId) : -1;
  for (let k = 1; k <= 2; k++) {
    const id = order[(start + k + 2) % 2];
    const p = table.players[id];
    if (p.folded || p.allIn) continue;
    if (!p.hasActed || p.betStreet < table.currentBet) return id;
  }
  return null;
}

function firstToAct(table) {
  for (const id of actionOrder(table)) {
    const p = table.players[id];
    if (!p.folded && !p.allIn) return id;
  }
  return null;
}

function cannotBet(table) {
  return living(table).filter((p) => !p.allIn).length < 2;
}

function showdown(table) {
  returnUncalled(table);
  table.street = "complete";
  table.toAct = null;
  table.showdown = true;
  table.revealed = true;
  const live = living(table);
  const ranked = live.map((p) => {
    const best = bestOf([...p.hole, ...table.board]);
    return { p, best, name: nameHand(best.value), nameZh: nameHandZh(best.value) };
  });
  ranked.sort((a, b) => compareHands(b.best.value, a.best.value));
  const top = ranked[0].best.value;
  const winners = ranked.filter((r) => compareHands(r.best.value, top) === 0);
  const share = Math.floor(table.pot / winners.length);
  let remainder = table.pot % winners.length;
  for (const w of winners) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    w.p.stack += share + extra;
  }
  table.winner = {
    ids: winners.map((w) => w.p.id),
    reason: "showdown",
    hands: Object.fromEntries(ranked.map((r) => [r.p.id, r.name])),
    handsZh: Object.fromEntries(ranked.map((r) => [r.p.id, r.nameZh])),
  };
  checkMatchOver(table);
}

function awardFold(table) {
  returnUncalled(table);
  const winner = living(table)[0];
  winner.stack += table.pot;
  table.street = "complete";
  table.toAct = null;
  table.winner = { ids: [winner.id], reason: "fold", hands: {} };
  checkMatchOver(table);
}

function checkMatchOver(table) {
  for (const id of IDS) {
    if (table.players[id].stack <= 0) {
      table.matchOver = otherId(id);
    }
  }
}

function beginStreet(table, street, dealCount) {
  table.street = street;
  for (const id of IDS) {
    const p = table.players[id];
    p.betStreet = 0;
    p.hasActed = false;
    p.lastAction = null;
  }
  table.currentBet = 0;
  table.lastRaiseSize = table.bigBlind;
  if (dealCount) dealTo(table, dealCount);
  if (living(table).length < 2) {
    awardFold(table);
    return;
  }
  if (cannotBet(table)) {
    table.revealed = true;
    runout(table);
    return;
  }
  table.toAct = firstToAct(table);
}

function runout(table) {
  while (table.board.length < 5) {
    const n = table.board.length === 0 ? 3 : 1;
    dealTo(table, n);
  }
  showdown(table);
}

function closeBetting(table) {
  if (living(table).length < 2) {
    awardFold(table);
    return;
  }
  if (!bettingDone(table)) {
    table.toAct = nextToAct(table, table.toAct);
    return;
  }
  returnUncalled(table);
  if (table.board.length >= 5) {
    showdown(table);
    return;
  }
  if (cannotBet(table)) {
    table.revealed = true;
    runout(table);
    return;
  }
  if (table.street === "preflop") beginStreet(table, "flop", 3);
  else if (table.street === "flop") beginStreet(table, "turn", 1);
  else if (table.street === "turn") beginStreet(table, "river", 1);
  else showdown(table);
}

export function startHand(table) {
  if (table.matchOver) return;
  if (table.handNumber > 0) table.button = otherId(table.button);
  table.handNumber += 1;
  table.board = [];
  table.deck = shuffle(makeDeck());
  table.pot = 0;
  table.events = [];
  table.winner = null;
  table.showdown = false;
  table.revealed = false;
  table.street = "preflop";
  table.currentBet = 0;
  table.lastRaiseSize = table.bigBlind;
  table.toAct = null;

  for (const id of IDS) {
    const p = table.players[id];
    p.hole = [];
    p.folded = false;
    p.allIn = false;
    p.betStreet = 0;
    p.committed = 0;
    p.hasActed = false;
    p.lastAction = null;
    if (p.stack <= 0) {
      table.matchOver = otherId(id);
      table.street = "complete";
      return;
    }
  }

  const order = [table.button, bbId(table)];
  for (let i = 0; i < 2; i++) {
    for (const id of order) table.players[id].hole.push(table.deck.pop());
  }

  const sb = table.players[table.button];
  const bb = table.players[bbId(table)];
  putChips(table, sb, table.smallBlind);
  putChips(table, bb, table.bigBlind);
  table.currentBet = Math.max(sb.betStreet, bb.betStreet);
  table.lastRaiseSize = table.bigBlind;
  table.events.push({ street: "preflop", actor: sb.id, type: "blind", amount: sb.betStreet });
  table.events.push({ street: "preflop", actor: bb.id, type: "blind", amount: bb.betStreet });

  if (living(table).filter((p) => !p.allIn).length < 2) {
    table.revealed = true;
    runout(table);
    return;
  }
  table.toAct = firstToAct(table);
}

export function getLegal(table, playerId) {
  if (table.toAct !== playerId || table.street === "complete") {
    return { actions: [], toCall: 0, minBet: table.bigBlind, minRaiseTo: 0, maxTo: 0 };
  }
  const p = table.players[playerId];
  const toCall = Math.max(0, table.currentBet - p.betStreet);
  const maxTo = p.betStreet + p.stack;
  const minBet = table.bigBlind;
  const minRaiseTo = table.currentBet + table.lastRaiseSize;
  const actions = [];

  if (toCall > 0) {
    actions.push("fold");
    if (p.stack > 0) actions.push("call");
    if (p.stack > toCall && maxTo >= minRaiseTo) actions.push("raise");
    if (p.stack > toCall) actions.push("allin");
  } else {
    actions.push("check");
    if (p.stack > 0) {
      if (p.stack > minBet) actions.push("bet");
      actions.push("allin");
    }
  }

  return {
    actions: [...new Set(actions)],
    toCall,
    minBet,
    minRaiseTo: Math.min(minRaiseTo, maxTo),
    maxTo,
  };
}

export function applyAction(table, playerId, action) {
  if (table.toAct !== playerId) throw new Error("还没轮到这个玩家");
  const p = table.players[playerId];
  const legal = getLegal(table, playerId);
  const type = action.type;
  if (!legal.actions.includes(type)) {
    throw new Error(`非法动作 ${type}`);
  }

  if (type === "fold") {
    p.folded = true;
    p.hasActed = true;
    p.lastAction = "fold";
    table.events.push({ street: table.street, actor: playerId, type: "fold" });
    awardFold(table);
    return;
  }

  if (type === "check") {
    p.hasActed = true;
    p.lastAction = "check";
    table.events.push({ street: table.street, actor: playerId, type: "check" });
    closeBetting(table);
    return;
  }

  if (type === "call") {
    const pay = putChips(table, p, legal.toCall);
    p.hasActed = true;
    p.lastAction = p.allIn ? "call all-in" : "call";
    table.events.push({
      street: table.street,
      actor: playerId,
      type: "call",
      amount: pay,
    });
    closeBetting(table);
    return;
  }

  if (type === "bet" || type === "raise") {
    const to = Number(action.to);
    const minTo = type === "bet" ? legal.minBet : legal.minRaiseTo;
    if (!Number.isFinite(to) || to < minTo - 1e-9 || to > legal.maxTo + 1e-9) {
      throw new Error("下注尺度不合法");
    }
    const add = to - p.betStreet;
    putChips(table, p, add);
    const prev = table.currentBet;
    table.lastRaiseSize = Math.max(table.lastRaiseSize, to - prev);
    table.currentBet = to;
    p.hasActed = true;
    const opp = table.players[otherId(playerId)];
    if (!opp.folded && !opp.allIn) opp.hasActed = false;
    p.lastAction = `${type} ${to}`;
    table.events.push({ street: table.street, actor: playerId, type, to });
    closeBetting(table);
    return;
  }

  if (type === "allin") {
    const prev = table.currentBet;
    const to = p.betStreet + p.stack;
    putChips(table, p, p.stack);
    const isRaise = to > prev;
    if (isRaise) {
      table.lastRaiseSize = Math.max(table.lastRaiseSize, to - prev);
      table.currentBet = to;
      const opp = table.players[otherId(playerId)];
      if (!opp.folded && !opp.allIn) opp.hasActed = false;
    }
    p.hasActed = true;
    p.lastAction = `all-in ${to}`;
    table.events.push({ street: table.street, actor: playerId, type: "allin", to });
    closeBetting(table);
  }
}

export function actorLabel(id) {
  return id === "hero" ? "Hero" : "Jev";
}

export function formatEvent(event) {
  const who = actorLabel(event.actor);
  if (event.type === "blind") return `${who} posts ${event.amount}`;
  if (event.type === "fold") return `${who} folds`;
  if (event.type === "check") return `${who} checks`;
  if (event.type === "call") return `${who} calls ${event.amount}`;
  if (event.type === "bet") return `${who} bets ${event.to}`;
  if (event.type === "raise") return `${who} raises to ${event.to}`;
  if (event.type === "allin") return `${who} is all-in ${event.to}`;
  return `${who} ${event.type}`;
}

export function buildJevState(table) {
  const me = table.players.jev;
  const opp = table.players.hero;
  const legal = getLegal(table, "jev");
  const holding = describeHolding(me.hole, table.board);
  const odds = potOdds(table.pot, legal.toCall);
  const spr = +(me.stack / Math.max(table.pot, 1)).toFixed(2);
  return {
    variant: "Heads-up no-limit Texas hold'em. Hero is Jev, the decision-maker. Villain hole cards are hidden.",
    street: table.street,
    hero: {
      position: table.button === "jev" ? "button / small blind" : "big blind",
      stack: me.stack,
      hole_cards: me.hole.map((c) => c.code),
      made_hand: holding.madeHand,
      draws: holding.draws.length ? holding.draws : ["no draw"],
    },
    villain: {
      position: table.button === "hero" ? "button / small blind" : "big blind",
      stack: opp.stack,
      last_action: opp.lastAction || "none",
    },
    board: table.board.length ? table.board.map((c) => c.code) : "preflop, no board yet",
    betting: {
      pot: table.pot,
      current_bet: table.currentBet,
      to_call: legal.toCall,
      pot_odds: odds.price,
      equity_needed_percent: odds.equity_needed_percent,
      spr,
      min_bet: legal.minBet,
      min_raise_to: legal.minRaiseTo,
      max_to: legal.maxTo,
      legal_actions: legal.actions,
    },
    action_history: table.events.map(formatEvent),
  };
}
