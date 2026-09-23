import { cardNameZh, rankFace } from "./cards.js";

export const RANK_WORD = {
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "jack",
  12: "queen",
  13: "king",
  14: "ace",
};

export const RANK_PLURAL = {
  2: "twos",
  3: "threes",
  4: "fours",
  5: "fives",
  6: "sixes",
  7: "sevens",
  8: "eights",
  9: "nines",
  10: "tens",
  11: "jacks",
  12: "queens",
  13: "kings",
  14: "aces",
};

export function combinations(arr, k) {
  const out = [];
  const n = arr.length;
  if (k <= 0 || k > n) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

export function compareHands(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

export function evaluate5(cards) {
  if (cards.length !== 5) throw new Error("evaluate5 needs 5 cards");
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);

  const uniqDesc = [...new Set(ranks)];
  let isStraight = false;
  let straightHigh = 0;
  if (uniqDesc.length === 5) {
    if (uniqDesc[0] - uniqDesc[4] === 4) {
      isStraight = true;
      straightHigh = uniqDesc[0];
    } else if (
      uniqDesc[0] === 14 &&
      uniqDesc[1] === 5 &&
      uniqDesc[2] === 4 &&
      uniqDesc[3] === 3 &&
      uniqDesc[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const count = new Map();
  for (const r of ranks) count.set(r, (count.get(r) || 0) + 1);
  const groups = [...count.entries()]
    .map(([r, n]) => ({ r, n }))
    .sort((a, b) => b.n - a.n || b.r - a.r);

  if (isStraight && isFlush) return [8, straightHigh];
  if (groups[0].n === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].n === 3 && groups[1].n === 2) return [6, groups[0].r, groups[1].r];
  if (isFlush) return [5, ...ranks];
  if (isStraight) return [4, straightHigh];
  if (groups[0].n === 3) {
    const kickers = ranks.filter((r) => r !== groups[0].r);
    return [3, groups[0].r, ...kickers];
  }
  if (groups[0].n === 2 && groups[1]?.n === 2) {
    const high = Math.max(groups[0].r, groups[1].r);
    const low = Math.min(groups[0].r, groups[1].r);
    const kicker = ranks.find((r) => r !== high && r !== low);
    return [2, high, low, kicker];
  }
  if (groups[0].n === 2) {
    const kickers = ranks.filter((r) => r !== groups[0].r);
    return [1, groups[0].r, ...kickers];
  }
  return [0, ...ranks];
}

function evaluatePartial(cards) {
  const ranks = [...cards].map((c) => c.rank).sort((a, b) => b - a);
  const count = new Map();
  for (const r of ranks) count.set(r, (count.get(r) || 0) + 1);
  const groups = [...count.entries()]
    .map(([r, n]) => ({ r, n }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  if (groups[0]?.n === 4) return [7, groups[0].r, groups[1]?.r || 0];
  if (groups[0]?.n === 3 && groups[1]?.n === 2) return [6, groups[0].r, groups[1].r];
  if (groups[0]?.n === 3) return [3, groups[0].r, ...ranks.filter((r) => r !== groups[0].r)];
  if (groups[0]?.n === 2 && groups[1]?.n === 2) {
    return [2, Math.max(groups[0].r, groups[1].r), Math.min(groups[0].r, groups[1].r), 0];
  }
  if (groups[0]?.n === 2) return [1, groups[0].r, ...ranks.filter((r) => r !== groups[0].r)];
  return [0, ...ranks];
}

export function bestOf(cards) {
  if (cards.length < 5) {
    return { value: evaluatePartial(cards), cards };
  }
  let best = null;
  for (const combo of combinations(cards, 5)) {
    const value = evaluate5(combo);
    if (!best || compareHands(value, best.value) > 0) best = { value, cards: combo };
  }
  return best;
}

export function nameHand(value) {
  const [cat, ...rest] = value;
  switch (cat) {
    case 8:
      return rest[0] === 14
        ? "a royal flush"
        : `a ${RANK_WORD[rest[0]]}-high straight flush`;
    case 7:
      return `four of a kind, ${RANK_PLURAL[rest[0]]}`;
    case 6:
      return `a full house, ${RANK_PLURAL[rest[0]]} full of ${RANK_PLURAL[rest[1]]}`;
    case 5:
      return `a ${RANK_WORD[rest[0]]}-high flush`;
    case 4:
      return `a ${RANK_WORD[rest[0]]}-high straight`;
    case 3:
      return `three of a kind, ${RANK_PLURAL[rest[0]]}`;
    case 2:
      return `two pair, ${RANK_PLURAL[rest[0]]} and ${RANK_PLURAL[rest[1]]}`;
    case 1:
      return `a pair of ${RANK_PLURAL[rest[0]]}`;
    default:
      return `${RANK_WORD[rest[0]]}-high`;
  }
}

export function nameHole(hole) {
  const [a, b] = [...hole].sort((x, y) => y.rank - x.rank);
  if (a.rank === b.rank) return `pocket ${RANK_PLURAL[a.rank]}`;
  const suited = a.suit === b.suit ? "suited" : "offsuit";
  return `${RANK_WORD[a.rank]}-${RANK_WORD[b.rank]} ${suited}`;
}

export function nameHoleZh(hole) {
  const [a, b] = [...hole].sort((x, y) => y.rank - x.rank);
  if (a.rank === b.rank) return `口袋对${rankFace(a.rank)}`;
  const suited = a.suit === b.suit ? "同花" : "杂色";
  return `${cardNameZh(a)} · ${cardNameZh(b)}（${suited}）`;
}

export function nameHandZh(value) {
  const [cat, ...rest] = value;
  const r = rankFace;
  switch (cat) {
    case 8:
      return rest[0] === 14 ? "皇家同花顺" : `${r(rest[0])}高同花顺`;
    case 7:
      return `四条${r(rest[0])}`;
    case 6:
      return `葫芦 ${r(rest[0])}满${r(rest[1])}`;
    case 5:
      return `${r(rest[0])}高同花`;
    case 4:
      return `${r(rest[0])}高顺子`;
    case 3:
      return `三条${r(rest[0])}`;
    case 2:
      return `两对 ${r(rest[0])}和${r(rest[1])}`;
    case 1:
      return `一对${r(rest[0])}`;
    default:
      return `${r(rest[0])}高牌`;
  }
}

export function categoryLabel(cat) {
  return [
    "high card",
    "one pair",
    "two pair",
    "three of a kind",
    "straight",
    "flush",
    "full house",
    "four of a kind",
    "straight flush",
  ][cat];
}
