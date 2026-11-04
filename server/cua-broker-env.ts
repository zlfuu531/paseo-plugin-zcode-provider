// Discover the running ZCode Desktop's Computer Use broker named pipe and hand
// its socket to the managed runtime via ZCODE_CUA_PERMISSION_BROKER_SOCKET.
// The broker is hosted by the Desktop helper and only exists while the Desktop
// app is running; an empty result leaves CUA unavailable for this launch.
//
// The standalone Server strips broker credentials before spawning the agent,
// so patches/zcode/0002-discover-desktop-cua-broker.patch performs the same
// discovery inside the runtime. This module keeps the Server environment
// consistent and covers paths that read it directly.
import { readdirSync } from "node:fs";

const WINDOWS_PIPE_ROOT = "\\\\.\\pipe\\";
const HELPER_PIPE_PREFIX = "zcode-cua-helper-";

export function zcodeCuaBrokerEnv(
  pipeRoot = WINDOWS_PIPE_ROOT,
): Record<string, string> {
  try {
    const helperPipe = readdirSync(pipeRoot)
      .filter((name) => {
        const normalized = name.toLowerCase();
        return (
          normalized.startsWith(HELPER_PIPE_PREFIX) &&
          normalized !== `${HELPER_PIPE_PREFIX}default`
        );
      })
      .sort()
      .at(-1);
    if (!helperPipe) return {};
    return {
      ZCODE_CUA_PERMISSION_BROKER_SOCKET: `${pipeRoot}${helperPipe}`,
    };
  } catch {
    // Non-Windows hosts and a stopped Desktop have no pipe.
    return {};
  }
}
