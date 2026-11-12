import { gte, parse } from "semver";
import type { RuntimeIdentity } from "./types.js";

export const ZCODE_SOURCE_COMMIT = "a9fe401eede6e6e5e01be9048679c206fe6f02d9";
// The compatible wire contracts and runtime source are pinned independently.
export const ZCODE_RUNTIME_SOURCE_COMMIT =
  "b95ebaffeab641907b38652f45c1502bd762972d";
export const MINIMUM_ZCODE_VERSION = { app: "3.18.0", cli: "0.17.1" } as const;
export const MINIMUM_NODE_VERSION = "24.14.0";

export function assessCompatibility(identity: RuntimeIdentity): {
  status: "supported" | "unsupported";
  reason: string;
} {
  for (const [component, version, minimum] of [
    ["app", identity.appVersion, MINIMUM_ZCODE_VERSION.app],
    ["CLI", identity.cliVersion, MINIMUM_ZCODE_VERSION.cli],
  ] as const) {
    const parsed = version === undefined ? null : parse(version);
    if (
      parsed === null ||
      parsed.prerelease.length !== 0 ||
      !gte(parsed, minimum)
    ) {
      return {
        status: "unsupported",
        reason: `ZCode ${component} requires a stable version >=${minimum}`,
      };
    }
  }
  return {
    status: "supported",
    reason:
      "ZCode Server and Agent meet the minimum stable versions; runtime compatibility is checked during use",
  };
}

// Last reviewed public changelog release; source versions are not releases.
export const LAST_REVIEWED_ZCODE_RELEASE = "3.18.0";
