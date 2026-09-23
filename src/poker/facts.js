import { bestOf, nameHand, nameHandZh, nameHole, nameHoleZh } from "./hand.js";

function windows() {
  const list = [];
  for (let high = 5; high <= 14; high++) {
    const ranks = [];
    for (let i = 0; i < 5; i++) {
      const r = high - i;
      ranks.push(r === 1 ? 14 : r);
    }
    list.push(ranks);
  }
  return list;
}

const STRAIGHT_WINDOWS = windows();

export function detectDraws(hole, board) {
  if (board.length === 0 || board.length >= 5) return [];
  const cards = [...hole, ...board];
  const draws = [];
  const bySuit = {};
  for (const c of cards) bySuit[c.suit] = (bySuit[c.suit] || 0) + 1;
  for (const [suit, n] of Object.entries(bySuit)) {
    if (!hole.some((c) => c.suit === suit)) continue;
    if (n >= 4) draws.push("flush draw");
    else if (n === 3 && board.length === 3) draws.push("backdoor flush draw");
  }

  const have = new Set(cards.map((c) => c.rank));
  const holeRanks = new Set(hole.map((c) => c.rank));
  let oesd = false;
  let gutshot = false;
  let backdoorStraight = false;

  for (const win of STRAIGHT_WINDOWS) {
    const missing = win.filter((r) => !have.has(r));
    const usesHole = win.some((r) => holeRanks.has(r));
    if (!usesHole) continue;
    if (missing.length === 1) {
      const miss = missing[0];
      const ends = [win[0], win[4]];
      if (ends.includes(miss) && !(win.includes(14) && win.includes(5) && miss === 14)) {
        oesd = true;
      } else {
        gutshot = true;
      }
    } else if (missing.length === 2 && board.length === 3) {
      backdoorStraight = true;
    }
  }

  if (oesd) draws.push("open-ended straight draw");
  else if (gutshot) draws.push("gutshot straight draw");
  else if (backdoorStraight) draws.push("backdoor straight draw");

  return [...new Set(draws)];
}

export const DRAW_ZH = {
  "flush draw": "同花听牌",
  "backdoor flush draw": "后门同花",
  "open-ended straight draw": "两头顺听牌",
  "gutshot straight draw": "卡顺听牌",
  "backdoor straight draw": "后门顺子",
};

export function describeHolding(hole, board) {
  if (!board.length) {
    return {
      category: hole[0].rank === hole[1].rank ? 1 : 0,
      madeHand: nameHole(hole),
      madeHandZh: nameHoleZh(hole),
      draws: [],
      drawsZh: [],
    };
  }
  const best = bestOf([...hole, ...board]);
  const draws = detectDraws(hole, board);
  return {
    category: best.value[0],
    madeHand: nameHand(best.value),
    madeHandZh: nameHandZh(best.value),
    draws,
    drawsZh: draws.map((d) => DRAW_ZH[d] || d),
  };
}

export function potOdds(pot, toCall) {
  if (toCall <= 0) {
    return {
      to_call: 0,
      price: "free to check",
      equity_needed_percent: 0,
    };
  }
  const need = toCall / (pot + toCall);
  return {
    to_call: toCall,
    price: `${((pot + toCall) / toCall).toFixed(2)}-to-1`,
    equity_needed_percent: +(need * 100).toFixed(1),
  };
}
