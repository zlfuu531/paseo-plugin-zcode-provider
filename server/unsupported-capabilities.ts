// Official ZCode capabilities that cannot run in the provider's standalone Server
// (ADR 19). Visualize (3.15.1+) needs Desktop's inline view host: ZCode gives
// its output directory only to Desktop-surface Agents and hides it from
// terminal sessions for that reason.
//
// Fork note (2026-11-04): Computer Use is enabled so Paseo sessions can drive
// the running ZCode Desktop's CUA broker. Browser Use stays suppressed because
// ZCode only allows its headless backend with --prompt, --target or tui, and
// the provider launches app-server; Paseo's own browser tools cover browser
// automation instead. Visualize also remains suppressed.
export const SUPPRESSED_OFFICIAL_PLUGINS = [
  "browser-use@zcode-plugins-official",
  "visualize@zcode-plugins-official",
] as const;

// Computer Use runs through this shared tool, so it must stay visible.
export const UNSUPPORTED_TOOLS = [] as const;

export const UNSUPPORTED_CAPABILITY_ENVIRONMENT = {
  // Keep the internal CUA feature enabled so the runtime resolves the
  // computer-use plugin and attaches the builtin node_repl MCP server.
  ZCODE_CUA_PRODUCT_HELPER: "1",
  // Read by patches/zcode/0001-hide-suppressed-official-plugins.patch.
  PASEO_ZCODE_SUPPRESSED_PLUGINS: SUPPRESSED_OFFICIAL_PLUGINS.join(","),
} as const;
