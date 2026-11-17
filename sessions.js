// no-effort — content
// A meditation wearing a coding agent's clothes.

window.NE = (function () {
  // ---- shell preamble (before the agent launches) ----
  const shell = [
    { raw: "Last login: Mon Jul  6 09:14:02 on ttys004" },
    { cwd: "~", cmd: "cd projects/no-effort" },
    { cwd: "~/projects/no-effort", cmd: "ls" },
    {
      out: [
        "app.js        index.html        README.md        sessions.js        styles.css",
      ],
    },
    { cwd: "~/projects/no-effort", cmd: "no-effort", type: true },
  ];

  // ---- welcome box ----
  const welcome = {
    version: "no-effort v1.0.0",
    greeting: "Welcome back.",
    mascot: [
      " ╭──────╮",
      " │ ·  · │",
      " │  ‿   │",
      " ╰──────╯",
    ],
    sub: [
      "no-effort · running on nothing",
      "the present moment",
      "~/projects/no-effort",
    ],

    by: { pre: "made with no effort by ", label: "tomreinert.de", url: "https://tomreinert.de" },
    tipsTitle: "Tips for getting started",
    tips: ["Ask for a practice and sit with it a while"],
    newTitle: "What's new",
    news: [
      "reasoning effort can now be set to none",
      "the default permission mode is now \"let it be\"",
      "sessions no longer track context; there is only now",
    ],
  };

  // ---- notices under the welcome box ----
  const notices = [];

  const promo = {
    title: "no-effort is available",
    body: "No usage limits and nothing to upgrade. Stay as long as you like.",
  };

  // ---- durations, chosen separately from the practice ----
  const durations = [
    { tag: "2 min",  desc: "a short return", ms: 2 * 60 * 1000 },
    { tag: "5 min",  desc: "settle in",      ms: 5 * 60 * 1000 },
    { tag: "10 min", desc: "the long sit",   ms: 10 * 60 * 1000 },
  ];

  // ---- the agent catches itself thinking ----
  const thinkStops = [
    "no. thinking is the distraction here.",
    "caught it. that thought can finish without you.",
    "cancelled. nothing needed figuring out.",
    "the plan was: no plan. returning.",
  ];

  // ---- tool calls for no-effort/none: looking for work, finding none ----
  const noneTools = [
    { fn: "check", arg: "thoughts", note: "several present. none require action." },
    { fn: "search", arg: "something to do", note: "no results found." },
    { fn: "lint", arg: "mind", note: "0 errors. wandering is not a warning." },
    { fn: "read", arg: "todo.md", note: "empty. it was always empty." },
    { fn: "watch", arg: "the breath", note: "still running. no changes detected." },
  ];

  const interstitials = [
    "the mind wandered. that's fine. begin again.",
    "no need to do this well. just do it.",
    "nothing to fix here.",
    "thoughts are arriving. let them pass through unanswered.",
    "you don't have to follow the next thought.",
    "notice the weight of your body in the chair.",
    "there is nowhere else to be right now.",
    "if you drifted, you already returned. that's the whole thing.",
    "loosen the shoulders. unclench the jaw.",
    "this breath is the only task.",
  ];

  // ---- practices ----
  const boxBreathing = {
    name: "no-effort/box",
    blurb: "four counts in, hold, out, hold. a steady square.",
    prompt: "guide me through box breathing. no effort.",
    permName: "breathe in a square",
    intro: [
      "okay. box breathing. we'll ease in first, no counting yet.",
    ],
    begin: "now: four in · four hold · four out · four hold.",
    pattern: [
      { verb: "Inhaling", secs: 4 },
      { verb: "Holding",  secs: 4 },
      { verb: "Exhaling", secs: 4 },
      { verb: "Holding",  secs: 4 },
    ],
    outro: "Done. Nothing changed. You're still here.",
  };

  const breathCounting = {
    name: "no-effort/breath",
    blurb: "count each exhale to ten, then begin again.",
    prompt: "count my breaths to ten. when I lose count, start over.",
    permName: "count your breaths",
    intro: [
      "okay. counting the breath. we'll ease in first.",
    ],
    begin: "now: count each exhale to ten, then begin again.",
    pattern: [
      { verb: "Inhaling", secs: 4 },
      { verb: "Exhaling", secs: 6, count: true },
    ],
    countTo: 10,
    outro: "Ten, or not ten. It doesn't matter now. You can stop.",
  };

  const bodyScan = {
    name: "no-effort/scan",
    blurb: "move attention head to feet, releasing each part.",
    prompt: "run a body scan. read each part, release it.",
    permName: "read your body, head to feet",
    intro: [
      "okay. a body scan. we'll ease in first.",
    ],
    begin: "now: attention moves from head to feet, releasing each part.",
    scan: [
      { part: "scalp",     note: "soften the scalp. let the forehead go smooth." },
      { part: "eyes",      note: "let the eyes rest back into the head." },
      { part: "jaw",       note: "unclench the jaw. part the teeth slightly." },
      { part: "shoulders", note: "let the shoulders drop away from the ears." },
      { part: "chest",     note: "let the breath move the chest on its own." },
      { part: "hands",     note: "open the hands. let the fingers uncurl." },
      { part: "belly",     note: "soften the belly. stop holding it in." },
      { part: "legs",      note: "let the legs be heavy against the floor." },
      { part: "feet",      note: "feel the feet. let them be still." },
    ],
    pattern: [
      { verb: "Inhaling", secs: 4 },
      { verb: "Exhaling", secs: 5 },
    ],
    outro: "The whole body, read and released. Nothing left to do.",
  };

  const justSit = {
    name: "no-effort/none",
    blurb: "do absolutely nothing. the advanced practice.",
    prompt: "do nothing. I mean it. nothing.",
    permName: "do nothing at all",
    intro: [
      "okay. nothing. the hardest one, so we'll ease in like always.",
    ],
    begin: "now: nothing. no counting, no scanning. the breath breathes itself.",
    none: true,
    labelText: "nothing",
    pattern: [
      { verb: "Inhaling", secs: 4 },
      { verb: "Exhaling", secs: 6 },
    ],
    outro: "Nothing happened. Perfect.",
  };

  const practices = [breathCounting, boxBreathing, bodyScan, justSit];

  return {
    shell, welcome, notices, promo, durations, practices, interstitials,
    thinkStops, noneTools,
  };
})();
