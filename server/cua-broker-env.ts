// Discover ZCode's Computer Use broker named pipe and hand its socket to the
// managed runtime via ZCODE_CUA_PERMISSION_BROKER_SOCKET. The plugin starts the
// official Desktop helper when no pipe exists; see cua-helper.ts.
//
// The standalone Server strips broker credentials before spawning the agent,
// so patches/zcode/0002-discover-desktop-cua-broker.patch performs the same
// discovery inside the runtime. This module keeps the Server environment
// consistent and covers paths that read it directly.
import { readdirSync } from "node:fs";

export const WINDOWS_PIPE_ROOT = "\\\\.\\pipe\\";
const HELPER_PIPE_PATTERN = /^zcode-cua-helper-[0-9a-f]{16}$/i;

export function listCuaHelperPipes(pipeRoot = WINDOWS_PIPE_ROOT): string[] {
  try {
    return readdirSync(pipeRoot).filter((name) =>
      HELPER_PIPE_PATTERN.test(name),
    );
  } catch {
    // Non-Windows hosts and a stopped helper have no pipe.
    return [];
  }
}

export function zcodeCuaBrokerEnv(
  pipeRoot = WINDOWS_PIPE_ROOT,
): Record<string, string> {
  const helperPipe = listCuaHelperPipes(pipeRoot).sort().at(-1);
  if (!helperPipe) return {};
  return {
    ZCODE_CUA_PERMISSION_BROKER_SOCKET: `${pipeRoot}${helperPipe}`,
  };
}
