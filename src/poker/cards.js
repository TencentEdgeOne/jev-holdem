export const SUITS = ["s", "h", "d", "c"];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_CHAR = {
  10: "T",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export const SUIT_GLYPH = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_COLOR = { s: "black", c: "black", h: "red", d: "red" };
export const SUIT_ZH = { s: "黑桃", h: "红心", d: "方块", c: "梅花" };

export function rankChar(rank) {
  return RANK_CHAR[rank] || String(rank);
}

export function rankFace(rank) {
  if (rank === 10) return "10";
  return RANK_CHAR[rank] || String(rank);
}

export function cardNameZh(card) {
  return `${SUIT_ZH[card.suit]}${rankFace(card.rank)}`;
}

export function makeCard(rank, suit) {
  return { rank, suit, code: `${rankChar(rank)}${suit}` };
}

export function parseCard(code) {
  const map = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
  const rankToken = code[0];
  const suit = code[1];
  const rank = map[rankToken] || Number(rankToken);
  return makeCard(rank, suit);
}

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(makeCard(rank, suit));
  }
  return deck;
}

export function shuffle(deck) {
  const a = deck.slice();
  const buf = new Uint32Array(a.length);
  (globalThis.crypto || {}).getRandomValues?.(buf);
  for (let i = a.length - 1; i > 0; i--) {
    const rand = buf[i] !== undefined ? buf[i] / 2 ** 32 : Math.random();
    const j = Math.floor(rand * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardLabel(card) {
  return `${rankChar(card.rank)}${SUIT_GLYPH[card.suit]}`;
}
