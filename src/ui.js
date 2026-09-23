import { rankFace, SUIT_COLOR, SUIT_GLYPH, cardNameZh } from "./poker/cards.js";
import { describeHolding } from "./poker/facts.js";
import { getLegal } from "./poker/engine.js";

export function chips(n) {
  return Math.round(n).toLocaleString("zh-CN");
}

export function cardHtml(card, { hidden = false, small = false, fresh = false, index = 0 } = {}) {
  const extra = `${small ? " small" : ""}${fresh ? " deal" : ""}`;
  const style = fresh ? ` style="--deal-i:${index}"` : "";
  if (!card || hidden) {
    return `<div class="card back${extra}"${style} aria-label="牌背"></div>`;
  }
  const color = SUIT_COLOR[card.suit];
  const glyph = SUIT_GLYPH[card.suit];
  const r = rankFace(card.rank);
  const name = cardNameZh(card);
  return `<div class="card ${color}${extra}${r === "10" ? " ten" : ""}"${style} data-code="${card.code}" aria-label="${name}">
    <span class="corner tl">${r}<i>${glyph}</i></span>
    <span class="face"><b>${r}</b><i>${glyph}</i></span>
    <span class="corner br">${r}<i>${glyph}</i></span>
  </div>`;
}

function streetLabel(street) {
  return {
    idle: "等待开局",
    preflop: "翻牌前",
    flop: "翻牌",
    turn: "转牌",
    river: "河牌",
    complete: "本手结束",
  }[street] || street;
}

function actionLabel(type) {
  return {
    fold: "弃牌",
    check: "让牌",
    call: "跟注",
    bet: "下注",
    raise: "加注",
    allin: "全下",
  }[type] || type;
}

function winnerText(table) {
  if (!table.winner) return "";
  const names = table.winner.ids.map((id) => (id === "hero" ? "你" : "Jev"));
  if (table.winner.reason === "fold") return `${names[0]} 赢下底池（对手弃牌）`;
  if (names.length > 1) return `平分底池`;
  const hand = table.winner.handsZh?.[table.winner.ids[0]] || table.winner.hands?.[table.winner.ids[0]];
  return `${names[0]} 摊牌获胜${hand ? ` · ${hand}` : ""}`;
}

function jevPanel(lastJev) {
  if (!lastJev) {
    return `<p class="muted">Jev 还没有行动。它会一次问完成牌强度、听牌、牌面危险度、是否弃牌/价值/诈唬，再由代码组合成注。</p>`;
  }
  if (lastJev.fallback) {
    return `<p class="warn">接口失败，已走后备启发式：${actionLabel(lastJev.action.type)}</p>`;
  }
  const a = lastJev.answers || {};
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const noul = (x) => (x == null ? "—" : Number(x).toFixed(2));
  const score = (x) => (x == null ? "—" : Number(x).toFixed(2));
  return `
    <div class="kv-grid">
      ${row("成牌", score(a.made_hand_strength?.score))}
      ${row("听牌", score(a.draw_equity?.score))}
      ${row("牌面", score(a.board_danger?.score))}
      ${row("弃牌", noul(a.fold_to_price?.noul))}
      ${row("价值", noul(a.value_bet?.noul))}
      ${row("诈唬", noul(a.bluff?.noul))}
      ${row("慢打", noul(a.trap?.noul))}
      ${row("线路", `${a.line?.choice || "—"} (${noul(a.line?.confidence)})`)}
      ${row("尺度", a.bet_size?.choice || "—")}
    </div>
    <p class="composed">组合成：<b>${actionLabel(lastJev.action.type)}${lastJev.action.to ? " " + lastJev.action.to : ""}</b> · 来源 ${lastJev.action.used}</p>
  `;
}

let seenHand = 0;
let seenBoard = 0;
let seenReveal = false;

export function render(app) {
  const t = app.table;
  const hero = t.players.hero;
  const jev = t.players.jev;
  const legal = getLegal(t, "hero");
  const heroHold = describeHolding(hero.hole, t.board);
  const showJev = t.revealed || t.showdown;
  const canAct = t.toAct === "hero" && !app.thinking;

  const newHand = t.handNumber !== seenHand;
  let boardFreshFrom = t.board.length;
  if (newHand) boardFreshFrom = 0;
  else if (t.board.length > seenBoard) boardFreshFrom = seenBoard;
  const jevFresh = newHand || (showJev && !seenReveal);
  seenHand = t.handNumber;
  seenBoard = t.board.length;
  seenReveal = showJev;

  const minTo = legal.actions.includes("bet")
    ? legal.minBet
    : legal.actions.includes("raise")
      ? legal.minRaiseTo
      : legal.maxTo;
  const betVal = app.betTo ?? minTo;
  const callAmt = legal.toCall;

  const board = t.board.length
    ? t.board
        .map((c, i) =>
          cardHtml(c, { fresh: i >= boardFreshFrom, index: i - boardFreshFrom }),
        )
        .join("")
    : `<div class="board-empty">等待发牌</div>`;

  const buttons = [];
  if (t.street === "complete") {
    if (t.matchOver) {
      buttons.push(`<button class="primary full" data-act="restart">${t.matchOver === "hero" ? "你赢下本局，再来" : "筹码没了，重新开局"}</button>`);
    } else {
      buttons.push(`<button class="primary full" data-act="next">下一手</button>`);
    }
  } else if (canAct) {
    const paired = [];
    if (legal.actions.includes("fold")) {
      paired.push([`fold`, `ghost danger`, `弃牌`]);
    }
    if (legal.actions.includes("check")) {
      paired.push([`check`, `ghost`, `让牌`]);
    }
    if (legal.actions.includes("call")) {
      paired.push([`call`, `ghost`, `跟注 ${chips(Math.min(callAmt, hero.stack))}`]);
    }
    const span = paired.length === 1 ? " full" : "";
    for (const [act, cls, label] of paired) {
      buttons.push(`<button data-act="${act}" class="${cls}${span}">${label}</button>`);
    }
    if (legal.actions.includes("bet") || legal.actions.includes("raise")) {
      const kind = legal.actions.includes("bet") ? "bet" : "raise";
      buttons.push(`<button data-act="${kind}" class="primary full">${kind === "bet" ? "下注" : "加注到"} ${chips(betVal)}</button>`);
    }
    if (legal.actions.includes("allin")) {
      buttons.push(`<button data-act="allin" class="allin full">全下 ${chips(hero.stack)}</button>`);
    }
  } else if (app.thinking) {
    buttons.push(`<div class="thinking full">${dots()}Jev 正在判断…</div>`);
  } else if (t.toAct === "jev") {
    buttons.push(`<div class="thinking full">${dots()}等待 Jev</div>`);
  }

  const bannerList = [
    app.error ? `<div class="banner warn">${escapeHtml(app.error)}</div>` : "",
    t.winner ? `<div class="banner win">${escapeHtml(winnerText(t))}</div>` : "",
  ].filter(Boolean);
  const banners = bannerList.length
    ? `<div class="banners" aria-live="polite">${bannerList.join("")}</div>`
    : "";

  const slider =
    canAct && (legal.actions.includes("bet") || legal.actions.includes("raise"))
      ? `<div class="sizer">
          <div class="size-presets">
            <button type="button" data-bet-preset="min">最小</button>
            <button type="button" data-bet-preset="third">1/3</button>
            <button type="button" data-bet-preset="pot">底池</button>
            <button type="button" data-bet-preset="max">最大</button>
          </div>
          <input type="range" min="${minTo}" max="${legal.maxTo}" value="${clamp(betVal, minTo, legal.maxTo)}" data-bet />
          <div class="sizer-labels"><span>${chips(minTo)}</span><span>${chips(legal.maxTo)}</span></div>
        </div>`
      : "";

  return `
    <div class="shell play">
      <header class="topbar">
        <div>
          <p class="eyebrow">Jev Hold'em</p>
          <h1>单挑无限德州</h1>
        </div>
        <div class="top-actions">
          <span class="pill">${streetLabel(t.street)} · 第 ${t.handNumber} 手</span>
          <button class="text" data-act="restart">重开</button>
        </div>
      </header>
      ${banners}
      <div class="layout">
        <section class="table-wrap">
          <div class="rail">
            <div class="seat jev${t.toAct === "jev" ? " is-turn" : ""}">
              <div class="seat-meta">
                <span class="name">Jev</span>
                ${dealerChip(t.button === "jev")}
                <span class="stack">${chips(jev.stack)}</span>
              </div>
              <div class="hole">${jev.hole.map((c, i) => cardHtml(c, { hidden: !showJev, fresh: jevFresh, index: i })).join("")}</div>
              <div class="last">${lastLine(t, "jev")}</div>
            </div>
            <div class="felt">
              <div class="pot">底池 <b>${chips(t.pot)}</b></div>
              <div class="board">${board}</div>
              <p class="street-tag">${streetLabel(t.street)}</p>
            </div>
            <div class="seat hero${canAct ? " is-turn" : ""}">
              <div class="hole">${hero.hole.map((c, i) => cardHtml(c, { fresh: newHand, index: i })).join("")}</div>
              <div class="seat-meta">
                <span class="name">你</span>
                ${dealerChip(t.button === "hero")}
                <span class="stack">${chips(hero.stack)}</span>
              </div>
              <p class="holding">${t.street === "idle" ? "" : heroHold.madeHandZh}${heroHold.drawsZh?.length ? " · " + heroHold.drawsZh.join(" / ") : ""}</p>
            </div>
          </div>
        </section>
        <div class="controls">
          ${slider}
          <div class="btn-row">${buttons.join("")}</div>
        </div>
        <aside class="side">
          <details class="panel" data-panel="jev" ${app.panelJev ? "open" : ""}>
            <summary>Jev 的判断</summary>
            ${jevPanel(app.lastJev)}
          </details>
          <details class="panel" data-panel="log" ${app.panelLog ? "open" : ""}>
            <summary>行动记录</summary>
            <ol class="log">
              ${[...t.events].reverse().map((e) => `<li><span>${streetLabel(e.street)}</span>${formatZhEvent(e)}</li>`).join("") || "<li class='muted'>还没有行动</li>"}
            </ol>
          </details>
        </aside>
      </div>
    </div>
  `;
}

function dots() {
  return `<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

function dealerChip(on) {
  return on ? `<span class="dealer" title="庄家">D</span>` : "";
}

function lastLine(table, id) {
  for (let i = table.events.length - 1; i >= 0; i--) {
    const e = table.events[i];
    if (e.actor === id && e.type !== "blind") return formatZhEvent(e);
  }
  return "";
}

function formatZhEvent(e) {
  const who = e.actor === "hero" ? "你" : "Jev";
  if (e.type === "blind") return `${who} 下盲注 ${e.amount}`;
  if (e.type === "fold") return `${who} 弃牌`;
  if (e.type === "check") return `${who} 让牌`;
  if (e.type === "call") return `${who} 跟注 ${e.amount}`;
  if (e.type === "bet") return `${who} 下注 ${e.to}`;
  if (e.type === "raise") return `${who} 加注到 ${e.to}`;
  if (e.type === "allin") return `${who} 全下 ${e.to}`;
  return `${who} ${e.type}`;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
