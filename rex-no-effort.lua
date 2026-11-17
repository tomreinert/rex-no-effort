-- no-effort for Rex: a meditation disguised as a coding agent.
--
-- Load it from init.lua (install.js does this):
--
--   dofile("/path/to/rex-no-effort/rex-no-effort.lua").setup{ node = "/path/to/node" }
--
-- The action opens a pane beside the focused one and starts a sit. The pane
-- closes when you leave (ctrl+c). In the palette as "Sit with no-effort", and
-- from a shell: rex do no_effort [split=right|left|above|below|tab]

local here = debug.getinfo(1, "S").source:gsub("^@", ""):match("^(.*)/[^/]*$") or "."
local CLI = here .. "/bin/no-effort.js"
local SHELL_FLAVOR = "com.superlogical.terminal.shell"

local M = {}

local function exists(path)
  local f = path and io.open(path, "r")
  if not f then return false end
  f:close()
  return true
end

-- Rex starts these panes with a plain PATH, so a node from nvm or similar isn't
-- on it. Use the node install.js recorded; if it's gone (say, after an upgrade),
-- let an interactive login shell find one.
local function command(opts)
  if exists(opts.node) then return { opts.node, CLI } end
  local shell = os.getenv("SHELL") or "/bin/zsh"
  return { shell, "-ilc", 'exec node "$0"', CLI }
end

local SIDES = {
  right = { "horizontal", "after" },
  left  = { "horizontal", "before" },
  below = { "vertical", "after" },
  above = { "vertical", "before" },
}

function M.setup(opts)
  opts = opts or {}

  rex.action{
    name  = "no_effort",
    title = "Sit with no-effort",
    args  = { split = "string?" },
    run   = function(ctx, args)
      if not exists(CLI) then error("no-effort: can't find " .. CLI, 0) end
      local where = args.split or opts.split or "right"
      local layout = rex.layout.block{
        flavor  = SHELL_FLAVOR,
        label   = "no-effort",
        options = { command = command(opts), cwd = os.getenv("HOME") },
      }
      if where == "tab" then
        local w, err = rex.session.new_window{
          session_id   = ctx.session_id,
          window_label = "no-effort",
          layout       = layout,
        }
        if err ~= nil then error(err, 0) end
        return { window_id = w.window_id }
      end
      local side = SIDES[where]
      if not side then error("no-effort: split must be right, left, above, below or tab", 0) end
      local s, err = rex.session.new_split{
        session_id = ctx.session_id,
        anchor_id  = ctx.block_id,
        direction  = side[1],
        side       = side[2],
        ratio      = opts.ratio or 0.5,
        focus      = true,
        layout     = layout,
      }
      if err ~= nil then error(err, 0) end
      return { block_id = s.block_ids[1] }
    end,
  }

  return M
end

return M
