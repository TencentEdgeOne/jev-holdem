import {
  applyAction,
  createTable,
  getLegal,
  resetMatch,
  startHand,
  buildJevState,
} from "./poker/engine.js";
import { describeHolding } from "./poker/facts.js";
import { systemOne } from "./jev/client.js";
import { decideFromAnswers, heuristicAction } from "./jev/policy.js";
import { render } from "./ui.js";
import "./style.css";

const root = document.getElementById("app");

const app = {
  table: createTable(),
  thinking: false,
  lastJev: null,
  error: null,
  betTo: null,
  handToken: 0,
  jevSteps: 0,
  panelJev: true,
  panelLog: typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches,
};

function paint() {
  root.innerHTML = render(app);
}

function syncBetDefault() {
  const legal = getLegal(app.table, "hero");
  if (legal.actions.includes("bet")) app.betTo = Math.min(legal.maxTo, Math.max(legal.minBet, Math.round(app.table.pot * 0.66) || legal.minBet));
  else if (legal.actions.includes("raise")) app.betTo = legal.minRaiseTo;
  else app.betTo = legal.maxTo;
}

function beginHand() {
  app.error = null;
  app.lastJev = null;
  app.thinking = false;
  app.handToken += 1;
  app.jevSteps = 0;
  startHand(app.table);
  syncBetDefault();
  paint();
  void maybeJev();
}

async function maybeJev() {
  if (app.thinking) return;
  const table = app.table;
  if (table.toAct !== "jev" || table.street === "complete") return;
  if (app.jevSteps > 16) return;
  const token = app.handToken;
  app.thinking = true;
  app.jevSteps += 1;
  app.error = null;
  paint();
  const legal = getLegal(table, "jev");
  try {
    const state = buildJevState(table);
    const res = await systemOne({ state });
    if (app.handToken !== token || table.toAct !== "jev") return;
    const action = decideFromAnswers(res.answers, legal, {
      pot: table.pot,
      stack: table.players.jev.stack,
      currentBet: table.currentBet,
    });
    app.lastJev = {
      answers: res.answers,
      action,
      usage: res.usage,
      model: res.model,
    };
    applyAction(table, "jev", action);
  } catch (err) {
    if (app.handToken !== token) return;
    const holding = describeHolding(table.players.jev.hole, table.board);
    const fallbackLegal = getLegal(table, "jev");
    const action = heuristicAction(fallbackLegal, holding.category);
    app.error = `${err.message}（已用后备策略）`;
    app.lastJev = { fallback: true, action };
    try {
      if (table.toAct === "jev") applyAction(table, "jev", action);
    } catch (inner) {
      app.error = inner.message;
    }
  } finally {
    if (app.handToken === token) {
      app.thinking = false;
      syncBetDefault();
      paint();
    }
  }
  if (app.handToken === token && app.table.toAct === "jev") void maybeJev();
}

function playerAct(type) {
  if (app.thinking || app.table.toAct !== "hero") return;
  try {
    if (type === "bet" || type === "raise") {
      applyAction(app.table, "hero", { type, to: Math.round(Number(app.betTo)) });
    } else {
      applyAction(app.table, "hero", { type });
    }
    app.error = null;
    syncBetDefault();
    paint();
    void maybeJev();
  } catch (err) {
    app.error = err.message;
    paint();
  }
}

root.addEventListener("click", (e) => {
  const preset = e.target.closest("[data-bet-preset]");
  if (preset) {
    applyBetPreset(preset.getAttribute("data-bet-preset"));
    return;
  }
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.getAttribute("data-act");
  if (act === "restart") {
    resetMatch(app.table);
    beginHand();
    return;
  }
  if (act === "next") {
    beginHand();
    return;
  }
  playerAct(act);
});

root.addEventListener("input", (e) => {
  const range = e.target.closest("[data-bet]");
  if (!range) return;
  app.betTo = Number(range.value);
  const btn = root.querySelector('[data-act="bet"], [data-act="raise"]');
  if (btn) {
    const kind = btn.getAttribute("data-act") === "bet" ? "下注" : "加注到";
    btn.textContent = `${kind} ${Math.round(app.betTo).toLocaleString("zh-CN")}`;
  }
});

root.addEventListener("toggle", (e) => {
  const panel = e.target.closest("[data-panel]");
  if (!panel) return;
  const key = panel.getAttribute("data-panel");
  if (key === "jev") app.panelJev = panel.open;
  if (key === "log") app.panelLog = panel.open;
}, true);

function applyBetPreset(kind) {
  const legal = getLegal(app.table, "hero");
  if (!legal.actions.includes("bet") && !legal.actions.includes("raise")) return;
  const minTo = legal.actions.includes("bet") ? legal.minBet : legal.minRaiseTo;
  const pot = app.table.pot;
  const currentBet = app.table.currentBet;
  let to = minTo;
  if (kind === "third") {
    to = legal.toCall === 0
      ? Math.max(minTo, Math.round(pot / 3))
      : Math.max(minTo, currentBet + Math.round(pot / 3));
  } else if (kind === "pot") {
    to = legal.toCall === 0
      ? Math.max(minTo, pot)
      : Math.max(minTo, currentBet + pot);
  } else if (kind === "max") {
    to = legal.maxTo;
  }
  app.betTo = Math.min(legal.maxTo, Math.max(minTo, Math.round(to)));
  const range = root.querySelector("[data-bet]");
  if (range) range.value = String(app.betTo);
  const btn = root.querySelector('[data-act="bet"], [data-act="raise"]');
  if (btn) {
    const label = btn.getAttribute("data-act") === "bet" ? "下注" : "加注到";
    btn.textContent = `${label} ${Math.round(app.betTo).toLocaleString("zh-CN")}`;
  }
}

resetMatch(app.table);
beginHand();
