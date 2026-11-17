#!/usr/bin/env node
// Adds no-effort to Rex's init.lua and reloads the config. Keeps a backup and
// puts the old file back if the result fails `rex config check`.
//
//   node install.js            add it
//   node install.js --remove   take it out again
"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REX = process.env.NO_EFFORT_REX || "rex";
const MODULE = path.join(__dirname, "rex-no-effort.lua");
const MARKER = "-- no-effort: a meditation disguised as a coding agent";
const BACKUP = ".bak-no-effort";

const configPath = (env = process.env) =>
  env.REX_CONFIG || path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "rex", "init.lua");

// A Lua string literal. Control characters are refused, not escaped.
function luaString(text) {
  if (/[\x00-\x1f\x7f]/.test(text)) throw new Error(`can't write ${JSON.stringify(text)} into init.lua`);
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const block = () =>
  `\n${MARKER} (https://github.com/tomreinert/rex-no-effort)\n` +
  `dofile(${luaString(MODULE)}).setup{ node = ${luaString(process.execPath)} }\n`;

const loadsModule = (config) => /^\s*dofile\s*\(?\s*["'][^"'\n]*rex-no-effort\.lua["']/m.test(config);

// The config without what block() added. Also drops a key binding left by an
// older version of this installer.
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

const rex = (args) => execFileSync(REX, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function checkConfig(file) {
  try { rex(["config", "check", file]); return { ok: true }; } catch (e) {
    if (e.code === "ENOENT") return { ok: false, text: "rex isn't installed" };
    const lines = `${e.stdout || ""}${e.stderr || ""}`.split(/\r?\n/);
    const line = lines.find((l) => /^\s*error\b/i.test(l)) ?? lines.find((l) => l.trim()) ?? "";
    return { ok: false, text: line.trim() };
  }
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
  console.log(`Removed no-effort from ${file}`);
}

function install(file) {
  const config = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (loadsModule(config)) return console.log(`no-effort is already in ${file}`);

  if (config) {
    const before = checkConfig(file);
    if (!before.ok) return fail(`Not installed: ${file} already has problems: ${before.text}`);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (config) fs.writeFileSync(file + BACKUP, config);
  fs.writeFileSync(file, config + block());

  const after = checkConfig(file);
  if (!after.ok) {
    if (config) fs.writeFileSync(file, config); else fs.rmSync(file);
    return fail(`Not installed, ${file} is unchanged: ${after.text}`);
  }
  reload();
  console.log(`Installed. Open it with "Sit with no-effort" in the command palette, or: rex do no_effort`);
}

function main(argv = process.argv.slice(2)) {
  const file = configPath();
  if (argv[0] === "--remove") return remove(file);
  if (argv[0]) return fail("usage: node install.js [--remove]");
  return install(file);
}

if (require.main === module) main();
module.exports = { block, removeBlock, loadsModule, luaString };
