# rex-no-effort

A meditation disguised as a coding agent, one key away in Rex.

Press the key and a pane opens beside the one you're in. Pick a "model" (a practice), pick how long you'll sit, grant it permission to breathe, and let it guide you. It looks like a coding agent at work; it does nothing at all. The pane closes when you leave.

Practices: `no-effort/breath` (count exhales to ten), `no-effort/box` (box breathing), `no-effort/scan` (body scan), `no-effort/none` (the advanced practice: nothing).

## Install

Needs Rex and Node 18 or newer. No npm packages.

```sh
git clone https://github.com/tomreinert/rex-no-effort.git ~/.config/rex/rex-no-effort
node ~/.config/rex/rex-no-effort/install.js
```

The installer adds three lines to your `init.lua` and reloads the config. It binds `cmd+alt+n`, or the first free key of `ctrl+alt+n`, `cmd+alt+m`, `ctrl+alt+m`. It never takes a key you already use, keeps a backup (`init.lua.bak-no-effort`), and puts the old file back if Rex doesn't accept the result.

```sh
node install.js ctrl+alt+p   # bind a key of your choice
node install.js --remove     # take it out again
```

Updating is `git pull`.

## Use

- the key you bound (`cmd+alt+n` by default)
- the command palette: "Sit with no-effort"
- a shell: `rex do no_effort`, or `rex do no_effort split=tab` (also `left`, `above`, `below`)

In the pane: ↑↓ (or j/k) and enter to choose, number keys to pick directly, esc to go back or end a sit, ctrl+c to leave.

## By hand

Instead of the installer, add this to `init.lua`:

```lua
dofile("/path/to/rex-no-effort/rex-no-effort.lua").setup{ node = "/path/to/node" }
rex.bind("cmd+alt+n", "no_effort")
```

`setup` options, all optional:

- `node`: path to Node. Rex starts panes with a plain `PATH`, so a Node from nvm isn't found there; without it, the action asks your login shell for one.
- `split`: where the pane opens by default: `right` (default), `left`, `above`, `below` or `tab`.
- `ratio`: share of the split the current pane keeps, `0.5` by default.

## Without Rex

It's a plain terminal program too: `node bin/no-effort.js`, or `npm link` once and then `no-effort`.

Made with no effort by [tomreinert.de](https://tomreinert.de).
