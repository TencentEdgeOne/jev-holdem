import { THRESHOLDS } from "./questions.js";

function isLegal(action, legal) {
  return legal.actions.includes(action);
}

function coerce(action, legal, foldP) {
  if (isLegal(action, legal)) return action;
  if (action === "fold" && isLegal("check", legal)) return "check";
  if (action === "check" && isLegal("call", legal)) {
    return foldP >= THRESHOLDS.foldNoul ? (isLegal("fold", legal) ? "fold" : "call") : "call";
  }
  if (action === "check" && isLegal("fold", legal) && foldP >= THRESHOLDS.foldNoul) {
    return "fold";
  }
  if (action === "bet" && isLegal("raise", legal)) return "raise";
  if (action === "raise" && isLegal("bet", legal)) return "bet";
  if (action === "call" && isLegal("check", legal)) return "check";
  if (action === "allin" && isLegal("raise", legal)) return "raise";
  if (action === "allin" && isLegal("bet", legal)) return "bet";
  if (isLegal("check", legal)) return "check";
  if (isLegal("call", legal)) return "call";
  if (isLegal("fold", legal)) return "fold";
  return legal.actions[0];
}

export function sizeToAmount(size, legal, { pot, currentBet }) {
  const { toCall, minBet, minRaiseTo, maxTo } = legal;
  if (size === "all_in") return maxTo;
  const minTo = toCall === 0 ? minBet : minRaiseTo;
  if (maxTo <= minTo) return maxTo;
  const frac = size === "small" ? 1 / 3 : size === "large" ? 1 : 0.66;
  const chunk = Math.max(1, Math.round(pot * frac));
  const target =
    toCall === 0
      ? Math.max(minTo, chunk)
      : Math.max(minTo, currentBet + chunk);
  const clamped = Math.min(maxTo, Math.max(minTo, target));
  if (maxTo - clamped <= minBet && maxTo > clamped) return maxTo;
  return clamped;
}

function composeFromSignals(answers, legal) {
  const foldP = answers.fold_to_price.noul;
  const valueP = answers.value_bet.noul;
  const bluffP = answers.bluff.noul;
  const trapP = answers.trap.noul;
  const strength = answers.made_hand_strength.score;
  const toCall = legal.toCall;

  if (
    toCall === 0 &&
    trapP >= THRESHOLDS.trapNoul &&
    strength >= THRESHOLDS.strongMadeScore
  ) {
    return "check";
  }
  if (
    toCall > 0 &&
    foldP >= THRESHOLDS.foldNoul &&
    valueP < 0.5 &&
    bluffP < THRESHOLDS.bluffNoul &&
    strength < THRESHOLDS.strongMadeScore
  ) {
    return "fold";
  }
  if (valueP >= THRESHOLDS.valueBetNoul) {
    return toCall > 0 ? "raise" : "bet";
  }
  if (bluffP >= THRESHOLDS.bluffNoul && strength < 2.2) {
    return toCall > 0 ? "raise" : "bet";
  }
  if (toCall > 0) return "call";
  return "check";
}

export function decideFromAnswers(answers, legal, { pot, stack, currentBet }) {
  const foldP = answers.fold_to_price?.noul ?? 0.5;
  const line = answers.line?.choice;
  const lineConf = answers.line?.confidence ?? 0;
  const size = answers.bet_size?.choice || "medium";
  const strength = answers.made_hand_strength?.score ?? 0;

  let used = "signals";
  let action;
  if (line && lineConf >= THRESHOLDS.lineConfidenceMin && isLegal(line, legal)) {
    action = line;
    used = "line";
  } else {
    action = composeFromSignals(answers, legal);
  }
  action = coerce(action, legal, foldP);

  const spr = stack / Math.max(pot, 1);
  if (
    (action === "bet" || action === "raise") &&
    spr <= THRESHOLDS.allInSpr &&
    isLegal("allin", legal) &&
    strength >= THRESHOLDS.strongMadeScore
  ) {
    action = "allin";
  }

  if (action === "allin") return { type: "allin", used, size };
  if (action === "bet" || action === "raise") {
    const to = sizeToAmount(size, legal, { pot, currentBet });
    if (to >= legal.maxTo) return { type: "allin", used, size };
    return { type: action, to, used, size };
  }
  return { type: action, used, size };
}

export function heuristicAction(legal, category) {
  const { toCall, actions, minBet, minRaiseTo, maxTo } = legal;
  if (!actions.length) return { type: "check" };
  if (toCall === 0) {
    if (category >= 2 && actions.includes("bet")) {
      return { type: "bet", to: Math.min(maxTo, Math.max(minBet, Math.round(minBet * 3))), used: "fallback" };
    }
    return { type: actions.includes("check") ? "check" : actions[0], used: "fallback" };
  }
  if (category === 0 && toCall > 0 && actions.includes("fold")) {
    return { type: "fold", used: "fallback" };
  }
  if (category >= 4 && actions.includes("raise")) {
    return { type: "raise", to: Math.min(maxTo, minRaiseTo), used: "fallback" };
  }
  if (actions.includes("call")) return { type: "call", used: "fallback" };
  return { type: actions[0], used: "fallback" };
}
