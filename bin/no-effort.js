#!/usr/bin/env node
// no-effort, terminal edition. Same content as the web version (sessions.js),
// rendered inline in a real terminal: scrollback above, a live dock below.
"use strict";

const path = require("path");
globalThis.window = globalThis;
require(path.join(__dirname, "..", "sessions.js"));
const NE = globalThis.NE;

const out = process.stdout;
const stdin = process.stdin;
if (!out.isTTY || !stdin.isTTY) {
  console.error("no-effort needs an interactive terminal.");
  process.exit(1);
}

// ---------- colors (truecolor, from styles.css; background left to the terminal) ----------
const PAL = {
  fg: [200, 204, 210], dim: [131, 139, 150], dimmer: [92, 99, 109],
  orange: [95, 176, 164], orangeHi: [116, 195, 182], green: [143, 174, 114],
  blue: [127, 160, 196], yellow: [220, 205, 43], red: [196, 120, 120],
  sel: [58, 63, 73], panel: [51, 56, 66],
};
const rgb = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
const bgc = ([r, g, b]) => `\x1b[48;2;${r};${g};${b}m`;
const RESET = "\x1b[0m";
const c = (name, s) => rgb(PAL[name]) + s + "\x1b[39m";
const italic = (s) => "\x1b[3m" + s + "\x1b[23m";
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const link = (url, text) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;

const strip = (s) =>
  s.replace(/\x1b\]8;;[^\x07]*\x07/g, "").replace(/\x1b\[[0-9;]*m/g, "");
const vlen = (s) => [...strip(s)].length;
const pad = (s, w) => s + " ".repeat(Math.max(0, w - vlen(s)));
const center = (s, w) => {
  const free = Math.max(0, w - vlen(s));
  const l = Math.floor(free / 2);
  return " ".repeat(l) + s + " ".repeat(free - l);
};
const cols = () => out.columns || 80;

// plain-text word wrap (used before coloring)
function wrap(text, width) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  lines.push(cur);
  return lines;
}

// ---------- renderer: full screen, redrawn from a line buffer ----------
// The transcript fills the screen from the top (only its newest rows when it
// overflows) and the dock is pinned to the bottom rows. Entries can be functions
// of the width, so the welcome card is rebuilt when the pane is resized.
const rowsN = () => out.rows || 24;
const history = []; // strings, or () => string[]
const HISTORY_MAX = 2000;
let liveLines = () => [];
let dockFn = () => [];

// Split a styled line into rows of at most `width` visible characters. Each new
// row starts by replaying the escapes seen so far, so colors carry over.
const TOKEN = /\x1b\]8;;[^\x07]*\x07|\x1b\[[0-9;]*m|[\s\S]/gu;
function wrapRow(line, width) {
  const rows = [];
  let cur = "";
  let n = 0;
  let style = "";
  for (const t of line.match(TOKEN) || []) {
    if (t.length > 1 && t[0] === "\x1b") {
      cur += t;
      if (t.endsWith("m")) style = t === RESET ? "" : style + t;
      continue;
    }
    if (n === width) { rows.push(cur + RESET); cur = style; n = 0; }
    cur += t;
    n++;
  }
  rows.push(cur + RESET);
  return rows;
}
const expand = (entries, width) =>
  entries.flatMap((e) => (typeof e === "function" ? e() : [e])).flatMap((l) => wrapRow(l, width));

function render() {
  const w = cols();
  const h = rowsN();
  const dock = expand(dockFn(), w).slice(-h);
  const room = h - dock.length;
  const body = expand([...history, ...liveLines()], w).slice(-room || h);
  while (body.length < room) body.push("");
  const frame = [...body.slice(0, room), ...dock];
  // synchronized output: the terminal shows the frame in one go, no flicker
  out.write("\x1b[?2026h\x1b[H" + frame.map((r) => r + "\x1b[K").join("\r\n") + "\x1b[J\x1b[?2026l");
}
function commit(...lines) {
  history.push(...lines);
  if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
  render();
}
const gap = () => commit("");

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const breaths = (n) => `${n} breath${n === 1 ? "" : "s"}`;
const SUB = c("dimmer", "  ⎿  ");

// ---------- live state ----------
const ui = {
  typing: null, // string: the line currently being typed
  pending: [], // lines shown above a menu that may still be taken back
  menu: null, // { title, items, index, footer, logLabel, onSelect }
  dock: false,
  status: null, // { verb, remaining, label, fill }
  input: "", // decorative prompt input
  inputTyping: false,
};

liveLines = () => {
  const ls = [];
  if (ui.typing !== null) ls.push(ui.typing);
  ls.push(...ui.pending);
  if (ui.menu) ls.push(...menuLines());
  return ls;
};
dockFn = () => (ui.dock ? dockLines() : []);

function dockLines() {
  const w = cols();
  const ls = [""];
  if (ui.status) {
    const { verb, remaining, label, fill } = ui.status;
    const BAR = 14;
    const f = Math.round((fill || 0) * BAR);
    // the dot breathes: brighter with the inhale, faded on the exhale
    const dot = rgb(lerp(PAL.dimmer, PAL.orangeHi, fill || 0)) + "⏺" + "\x1b[39m";
    const count = remaining == null ? "" : c("dim", `(${remaining}s)`) + "  ";
    const lab = label ? ` · ↑ ${label}` : "";
    ls.push(
      dot + " " + c("fg", verb + "…") + " " + count +
      c("orange", "█".repeat(f)) + c("dimmer", "░".repeat(BAR - f)) +
      c("dim", `${lab} · esc to return`),
    );
  } else ls.push("");
  const rule = c("dimmer", "─".repeat(Math.max(10, w - 1)));
  const inner = ui.inputTyping
    ? c("fg", ui.input) + "\x1b[7m \x1b[27m"
    : c("dimmer", italic("nothing to input right now"));
  ls.push(rule, c("dim", "> ") + inner, rule);
  const left = c("dim", "  Context: ∞");
  const right = c("orange", "⏵⏵ no-effort mode on") + c("dimmer", " (nothing to cycle)");
  const space = w - 1 - vlen(left) - vlen(right);
  ls.push(space >= 2 ? left + " ".repeat(space) + right : "  " + right);
  return ls;
}

// ---------- typing ----------
async function type(text, { prefix = "", color = "fg", speed = 30, jitter = 12 } = {}) {
  if (cancelled()) { commit(prefix + c(color, text)); return; }
  let shown = "";
  for (const ch of text) {
    if (cancelled()) break;
    shown += ch;
    ui.typing = prefix + c(color, shown);
    render();
    await sleep((ch === " " ? speed * 0.4 : speed) + Math.random() * jitter);
  }
  ui.typing = null;
  commit(prefix + c(color, text));
}

// ---------- menus ----------
function menuLines() {
  const m = ui.menu;
  const ls = ["", c("yellow", m.title), ""];
  m.items.forEach((it, i) => {
    const on = i === m.index;
    const head = `${i + 1}. ${it.label.padEnd(18, " ")}`;
    let desc = " · " + it.desc;
    const room = cols() - 1 - 2 - head.length;
    if (desc.length > room) desc = room > 4 ? desc.slice(0, room - 1) + "…" : "";
    const row = c("orange", on ? "❯ " : "  ") + c("fg", head) + c("dim", desc);
    ls.push(on ? bgc(PAL.sel) + pad(row, Math.min(cols() - 1, vlen(row) + 1)) + "\x1b[49m" : row);
  });
  ls.push("", c("dimmer", m.footer));
  return ls;
}
function showMenu(title, items, footer, logLabel, onSelect, index = 0) {
  ui.menu = { title, items, footer, logLabel, onSelect, index };
  render();
}
function chooseMenu() {
  const m = ui.menu;
  ui.menu = null;
  const logged = c("orange", "⏺ ") + c("dim", m.logLabel + " · ") + c("fg", m.items[m.index].label);
  m.onSelect(m.index, logged);
}

// ---------- state ----------
let mode = "boot"; // boot | practice | duration | running
let practiceIndex = 0;
let chosenPractice = null;
let session = null;
const cancelled = () => !!(session && session.cancelled);
const timeUp = () => !!(session && session.endAt - Date.now() <= 0);
const ended = () => cancelled() || timeUp();

// ---------- welcome ----------
function welcomeLines() {
  const w = NE.welcome;
  const W = cols() - 1;
  const inner = W - 4;
  const two = inner >= 66;
  const leftW = two ? Math.max(32, Math.floor(inner * 0.38)) : inner;
  const rightW = two ? inner - leftW - 3 : inner;

  const left = [
    ...w.mascot.map((m) => c("orangeHi", center(m.padEnd(10), leftW))),
    "",
    c("fg", center(w.greeting, leftW)),
    "",
    ...w.sub.map((s) => c("dim", center(s, leftW))),
  ];
  const right = [
    c("orange", w.tipsTitle),
    ...w.tips.flatMap((t) => wrap(t, rightW).map((l) => c("dim", l))),
    c("dimmer", "─".repeat(rightW)),
    c("orange", w.newTitle),
    ...w.news.flatMap((n) => wrap(n, rightW).map((l) => c("dim", l))),
  ];
  if (w.by) right.push("", c("dim", w.by.pre) + c("orange", link(w.by.url, w.by.label)));

  const B = (s) => c("orange", s);
  const title = ` ${w.version} `;
  const lines = [B("╭─") + c("orange", title) + B("─".repeat(Math.max(0, W - 3 - title.length)) + "╮")];
  const row = (s) => B("│") + " " + pad(s, inner) + " " + B("│");
  lines.push(row(""));
  if (two) {
    const n = Math.max(left.length, right.length);
    for (let i = 0; i < n; i++) {
      lines.push(row(pad(left[i] || "", leftW) + "   " + (right[i] || "")));
    }
  } else {
    for (const l of left) lines.push(row(l));
    lines.push(row(""));
    for (const r of right) lines.push(row(r));
  }
  lines.push(row(""));
  lines.push(B("╰" + "─".repeat(W - 2) + "╯"));
  return lines;
}

function boot() {
  commit(welcomeLines); // rebuilt at the current width on every redraw
  gap();
  commit(c("orange", NE.promo.title), c("dim", NE.promo.body));
  ui.dock = true;
  showPracticeMenu();
}

function showPracticeMenu() {
  mode = "practice";
  showMenu(
    "Select a model:",
    NE.practices.map((p) => ({ label: p.name, desc: p.blurb })),
    "↑↓ · enter to choose · ctrl+c to leave",
    "model",
    (i, logged) => {
      practiceIndex = i;
      chosenPractice = NE.practices[i];
      ui.pending = [logged]; // stays live until a duration is picked, so esc can take it back
      showDurationMenu();
    },
    practiceIndex,
  );
}

function showDurationMenu() {
  mode = "duration";
  showMenu(
    "How long will you sit?",
    NE.durations.map((d) => ({ label: d.tag, desc: d.desc })),
    "↑↓ · enter to begin · esc to go back",
    "duration",
    (i, logged) => {
      const p = ui.pending;
      ui.pending = [];
      commit("", ...p, logged);
      startSession(chosenPractice, NE.durations[i].ms);
    },
  );
}

function durationBack() {
  ui.pending = [];
  ui.menu = null;
  showPracticeMenu();
}

// ---------- session ----------
async function typeIntoInput(text) {
  ui.input = "";
  ui.inputTyping = true;
  for (const ch of text) {
    ui.input += ch;
    render();
    await sleep(28 + Math.random() * 22);
  }
  await sleep(400);
}
function submitPrompt(text) {
  ui.input = "";
  ui.inputTyping = false;
  const body = " > " + text + " ";
  const w = Math.min(cols() - 1, Math.max(vlen(body), 1));
  commit(bgc(PAL.panel) + c("dim", " > ") + c("fg", text + " ") + " ".repeat(Math.max(0, w - vlen(body))) + "\x1b[49m");
}

async function startSession(practice, durationMs) {
  mode = "running";
  session = {
    cancelled: false, endAt: Infinity, startAt: Date.now(),
    breaths: 0, count: 0, currentPart: "settling in", permitted: false,
  };

  gap();
  await typeIntoInput(practice.prompt);
  submitPrompt(practice.prompt);
  gap();
  await sleep(400);

  for (let i = 0; i < practice.intro.length && !cancelled(); i++) {
    await type(practice.intro[i], { prefix: i === 0 ? c("orange", "⏺ ") : "  " });
    await sleep(700);
  }
  gap();
  await sleep(800);

  await arrive();
  if (cancelled()) return endSession(practice, true);

  await askPermission(practice);
  if (cancelled()) return endSession(practice, true);

  await sleep(1000);
  if (practice.begin) await type(practice.begin, { prefix: c("orange", "⏺ ") });
  await sleep(1800);
  if (cancelled()) return endSession(practice, true);

  breathFill = 0;
  ui.status = { verb: "Settling", remaining: null, label: "", fill: 0 };
  render();
  await sleep(2800);
  if (cancelled()) return endSession(practice, true);

  session.startAt = Date.now();
  session.endAt = Date.now() + durationMs;
  await Promise.all([runBreath(practice), runContent(practice)]);
  return endSession(practice, session.cancelled);
}

async function askPermission(practice) {
  gap();
  showMenu(
    "no-effort requests permission to " + practice.permName,
    [
      { label: "Allow", desc: "just this once" },
      { label: "Allow always", desc: "there is no always, there is only now" },
    ],
    "enter to allow · esc to leave",
    "permission",
    (i, logged) => { commit(logged); session.permitted = true; },
  );
  while (!session.permitted && !cancelled()) await sleep(120);
}

async function arrive() {
  await type("first, arrive. three slow breaths, no counting", { prefix: SUB, color: "dim" });
  await napUntil(2000);
  for (const word of ["one", "two", "three"]) {
    if (cancelled()) return;
    // type the word, then let dots tick on (kept live until the next count)
    let shown = "";
    for (const ch of word) {
      if (cancelled()) break;
      shown += ch;
      ui.typing = SUB + c("dim", shown);
      render();
      await sleep(90 + Math.random() * 12);
    }
    const until = Date.now() + 7500;
    let dots = "";
    while (Date.now() < until) {
      if (!(await napUntil(900))) break;
      dots += ".";
      ui.typing = SUB + c("dim", word + dots);
      render();
    }
    ui.typing = null;
    commit(SUB + c("dim", word + dots));
    if (cancelled()) return;
  }
  await napUntil(2400);
}

async function napUntil(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (ended()) return false;
    await sleep(200);
  }
  return true;
}

// ---- the breath ----
let breathFill = 0;
async function phase({ verb, secs, label }) {
  const countDur = secs * 1000;
  const totalDur = (secs + 1) * 1000;
  const start = Date.now();
  for (;;) {
    if (cancelled()) return;
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, secs - Math.floor(elapsed / 1000));
    const p = Math.min(1, elapsed / countDur);
    let fill;
    if (verb === "Inhaling") fill = p;
    else if (verb === "Exhaling") fill = 1 - p;
    else fill = breathFill;
    breathFill = fill;
    ui.status = { verb, remaining, label: label(), fill };
    render();
    if (elapsed >= totalDur) break;
    await sleep(80);
  }
}

async function runBreath(practice) {
  const labelFn = practice.scan
    ? () => session.currentPart
    : practice.countTo
    ? () => (session.count ? String(session.count) : "—")
    : practice.labelText
    ? () => practice.labelText
    : () => breaths(session.breaths);
  while (!ended()) {
    for (const ph of practice.pattern) {
      if (cancelled() || timeUp()) break;
      if (practice.countTo && ph.count) session.count = (session.count % practice.countTo) + 1;
      if (ph.verb === "Inhaling") session.breaths++;
      await phase({ verb: ph.verb, secs: ph.secs, label: labelFn });
    }
  }
}

// ---- the guidance ----
async function runContent(practice) {
  if (ended()) return;
  if (practice.scan) await contentScan(practice);
  else if (practice.none) await contentNone();
  else await contentIdle();
}
async function contentScan(practice) {
  if (!(await napUntil(9000))) return;
  for (const item of practice.scan) {
    if (ended()) return;
    session.currentPart = item.part;
    await toolCall("scan", item.part, item.note);
    if (!(await napUntil(12000))) return;
  }
  session.currentPart = "resting";
  await contentIdle();
}
async function contentIdle() {
  while (!ended()) {
    if (!(await napUntil(24000 + Math.random() * 12000))) return;
    if (ended()) return;
    if (Math.random() < 0.25) await thinkingGag();
    else await interstitial();
  }
}
async function contentNone() {
  while (!ended()) {
    if (!(await napUntil(18000 + Math.random() * 10000))) return;
    if (ended()) return;
    const r = Math.random();
    if (r < 0.3) await thinkingGag();
    else if (r < 0.65) {
      const t = rand(NE.noneTools);
      await toolCall(t.fn, t.arg, t.note);
    } else await interstitial();
  }
}
async function thinkingGag() {
  commit(c("dim", italic("✻ Thinking…")));
  if (!(await napUntil(2600))) return;
  await type(rand(NE.thinkStops), { prefix: SUB, color: "dim" });
  await sleep(450);
}
async function toolCall(fn, arg, note) {
  commit(c("orange", "⏺ ") + c("fg", fn + "(") + c("blue", arg) + c("fg", ")"));
  await sleep(700);
  await type(note, { prefix: SUB, color: "dim" });
  await sleep(700);
}
async function interstitial() {
  await type(rand(NE.interstitials), { prefix: SUB, color: "dim" });
  await sleep(700);
}

async function endSession(p, early) {
  ui.status = null;
  ui.typing = null;
  ui.menu = null;
  gap();
  if (early) {
    commit(c("red", "  ⎿  Interrupted by user"));
    await sleep(500);
    commit(c("orange", "⏺ ") + c("dim", "returned. nothing was left unfinished."));
  } else {
    await type(p.outro, { prefix: c("green", "⏺ "), speed: 34 });
  }
  await sleep(1000);
  const elapsed = Math.max(0, Math.round((Math.min(Date.now(), session.endAt) - session.startAt) / 1000));
  const m = Math.floor(elapsed / 60);
  const dur = (m ? m + "m " : "") + (elapsed % 60) + "s";
  gap();
  commit(
    c("orange", "⏺ ") + c("fg", early ? "session ended early (that's allowed)" : "session complete"),
    SUB + c("dim", `${dur} · ${breaths(session.breaths)} · 0 files changed`),
    "     " + c("dim", "total cost: $0.00 · total effort: none · context used: none"),
  );
  await sleep(1000);
  session = null;
  showPracticeMenu();
}

// ---------- input ----------
function quit() {
  ui.menu = null;
  ui.status = null;
  ui.typing = null;
  ui.pending = [];
  ui.dock = false;
  out.write("\x1b[?1049l\x1b[?25h"); // back to the normal screen
  out.write(c("dim", "⏺ left. nothing was left unfinished.") + RESET + "\n");
  stdin.setRawMode(false);
  process.exit(0);
}

function onKey(key) {
  if (key === "\x03" || key === "\x04") return quit(); // ctrl+c, ctrl+d
  const UP = key === "\x1b[A" || key === "\x1bOA" || key === "k";
  const DOWN = key === "\x1b[B" || key === "\x1bOB" || key === "j";
  const ENTER = key === "\r" || key === "\n";
  const ESC = key === "\x1b";

  const m = ui.menu;
  if (m) {
    const len = m.items.length;
    const n = parseInt(key, 10);
    if (ESC) {
      if (mode === "duration") durationBack();
      else if (mode === "running" && session) { ui.menu = null; session.cancelled = true; render(); }
    } else if (key === "q" && mode === "practice") {
      quit();
    } else if (ENTER) {
      chooseMenu();
    } else if (n >= 1 && n <= len) {
      m.index = n - 1;
      chooseMenu();
    } else if (UP || DOWN) {
      m.index = (m.index + (DOWN ? 1 : -1) + len) % len;
      if (mode === "practice") practiceIndex = m.index;
      render();
    }
    return;
  }
  if (mode === "running" && ESC && session) session.cancelled = true;
}

stdin.setRawMode(true);
stdin.setEncoding("utf8");
stdin.on("data", onKey);
out.on("resize", render);
process.on("exit", () => out.write("\x1b[?1049l\x1b[?25h"));
out.write("\x1b[?1049h\x1b[?25l"); // own screen, hidden cursor
boot();
