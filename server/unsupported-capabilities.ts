// Official ZCode capabilities that cannot run in the provider's standalone Server
// (ADR 19). Visualize (3.15.1+) needs Desktop's inline view host: ZCode gives
// its output directory only to Desktop-surface Agents and hides it from
// terminal sessions for that reason.
//
// Fork note (2026-11-04): Computer Use is enabled so Paseo sessions can drive
// the running ZCode Desktop's CUA broker, and Browser Use stays enabled to
// match the local setup this branch was merged from. Browser Use is not
// verified in the standalone Server; Visualize remains suppressed.
export const SUPPRESSED_OFFICIAL_PLUGINS = [
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
