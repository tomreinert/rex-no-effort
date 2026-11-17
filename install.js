#!/usr/bin/env node
// Adds no-effort to Rex's init.lua: loads rex-no-effort.lua and binds a key to
// its no_effort action, then reloads the config. Rex has no plugin manager, so
// this is the install step. It never takes a key the config already binds, keeps
// a backup, and puts the old file back if the result fails `rex config check`.
// (Modeled on the installers in github.com/luongnv89/rex-extensions.)
//
//   node install.js             bind cmd+alt+n, or the first free fallback
//   node install.js ctrl+alt+m  bind this key
//   node install.js --remove    take it out of init.lua again
"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REX = process.env.NO_EFFORT_REX || "rex";
const ACTION = "no_effort";
const MODULE = path.join(__dirname, "rex-no-effort.lua");
const CANDIDATES = ["cmd+alt+n", "ctrl+alt+n", "cmd+alt+m", "ctrl+alt+m"];
const MARKER = "-- no-effort: a meditation disguised as a coding agent";
const BACKUP = ".bak-no-effort";

const configPath = (env = process.env) =>
  env.REX_CONFIG || path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "rex", "init.lua");

// A Lua string literal. Control characters are refused, not escaped.
function luaString(text) {
  if (/[\x00-\x1f\x7f]/.test(text)) throw new Error(`can't write ${JSON.stringify(text)} into init.lua`);
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const block = (key) =>
  `\n${MARKER} (https://github.com/tomreinert/rex-no-effort)\n` +
  `dofile(${luaString(MODULE)}).setup{ node = ${luaString(process.execPath)} }\n` +
  `rex.bind(${luaString(key)}, "${ACTION}")\n`;

const loadsModule = (config) => /^\s*dofile\s*\(?\s*["'][^"'\n]*rex-no-effort\.lua["']/m.test(config);

function removeBlock(config) {
  const lines = config.split(/(?<=\n)/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(MARKER)) {
      if (out.length && out[out.length - 1].trim() === "") out.pop();
      while (
        i + 1 < lines.length &&
        /^\s*(dofile\s*\(.*rex-no-effort\.lua|rex\.bind\s*\(.*"no_effort")/.test(lines[i + 1])
      ) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("");
}

const rex = (args, opts = {}) =>
  execFileSync(REX, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

function checkConfig(file) {
  try { rex(["config", "check", file]); return { ok: true }; } catch (e) {
    if (e.code === "ENOENT") return { ok: false, text: "rex isn't installed" };
    const lines = `${e.stdout || ""}${e.stderr || ""}`.split(/\r?\n/);
    const line = lines.find((l) => /^\s*error\b/i.test(l)) ?? lines.find((l) => l.trim()) ?? "";
    return { ok: false, text: line.trim() };
  }
}

// Which of `keys` the config already binds. Rex normalizes key names
// ("cmd+alt+n" reads back as "alt+cmd+n"), so both sides go through rex.bind.
// Handlers and timers are stubbed out: only the bindings matter here.
const INSPECT = `
rex.on = function() end
rex.every = function() end
rex.after = function() end
local used = {}
if rex.args.dir ~= "" then
  -- init.lua may require() files next to it, as the server allows
  package.path = rex.args.dir .. "/?.lua;" .. rex.args.dir .. "/?/init.lua;" .. package.path
end
if rex.args.file ~= "" then
  dofile(rex.args.file)
  for _, b in ipairs(rex.bindings()) do used[#used + 1] = b.key end
end
local keys = {}
for k in string.gmatch(rex.args.keys, "[^ ]+") do
  rex.bind(k, "${ACTION}")
  local all = rex.bindings()
  keys[k] = all[#all].key
end
return { used = used, keys = keys }`;

function usedKeys(file, keys) {
  const out = JSON.parse(
    rex(["do", "-e", INSPECT, "--args", JSON.stringify({ file, dir: file ? path.dirname(file) : "", keys: keys.join(" ") }), "--json"], { timeout: 15000 }),
  );
  const used = new Set(Array.isArray(out?.used) ? out.used : []);
  return new Set(keys.filter((k) => used.has(out?.keys?.[k] ?? k)));
}

function reload() {
  if (process.env.NO_EFFORT_NO_RELOAD) return;
  try { rex(["config", "reload"]); } catch {}
}

function fail(message) {
  console.log(message);
  process.exitCode = 1;
}

function remove(file) {
  const config = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!config.includes(MARKER)) return console.log(`no-effort isn't in ${file}`);
  fs.writeFileSync(file + BACKUP, config);
  fs.writeFileSync(file, removeBlock(config));
  reload();
  console.log(`Took no-effort out of ${file} (backup: ${path.basename(file)}${BACKUP})`);
}

function install(file, asked) {
  const config = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (loadsModule(config)) return console.log(`no-effort is already in ${file}`);

  if (config) {
    const before = checkConfig(file);
    if (!before.ok) return fail(`Not installed: ${file} already has problems: ${before.text}`);
  }

  const wanted = asked ? [asked] : CANDIDATES;
  let used;
  try { used = usedKeys(config ? file : "", wanted); } catch (e) {
    return fail(`Not installed: couldn't read the keys ${file} binds (${(e.stderr || e.message).trim()})`);
  }
  const key = wanted.find((k) => !used.has(k));
  if (!key) {
    return fail(asked
      ? `Not installed: ${asked} is already bound in ${file}. Pick another: node install.js <key>`
      : `Not installed: ${CANDIDATES.join(", ")} are all bound. Pick one: node install.js <key>`);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (config) fs.writeFileSync(file + BACKUP, config);
  fs.writeFileSync(file, config + block(key));

  const after = checkConfig(file);
  if (!after.ok) {
    if (config) fs.writeFileSync(file, config); else fs.rmSync(file);
    return fail(`Not installed, ${file} is unchanged: ${after.text}`);
  }
  reload();
  console.log(`Installed no-effort in ${file}`);
  console.log(`Press ${key}, pick "Sit with no-effort" in the palette, or run: rex do no_effort`);
  if (config) console.log(`Backup: ${path.basename(file)}${BACKUP} · remove with: node install.js --remove`);
}

function main(argv = process.argv.slice(2)) {
  const file = configPath();
  if (argv[0] === "--remove") return remove(file);
  if (argv[0] && argv[0].startsWith("-")) return fail("usage: node install.js [key] | --remove");
  return install(file, argv[0]);
}

if (require.main === module) main();
module.exports = { block, removeBlock, loadsModule, luaString };
