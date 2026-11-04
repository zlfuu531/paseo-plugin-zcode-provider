import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { zcodeCuaBrokerEnv } from "./cua-broker-env.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function pipeRoot(...names: string[]): string {
  const directory = mkdtempSync(join(tmpdir(), "zcode-cua-pipes-"));
  directories.push(directory);
  for (const name of names) writeFileSync(join(directory, name), "");
  return directory + sep;
}

it("returns no environment when only the default placeholder pipe exists", () => {
  expect(zcodeCuaBrokerEnv(pipeRoot("zcode-cua-helper-default"))).toEqual({});
});

it("uses the last helper pipe as the broker socket", () => {
  const root = pipeRoot(
    "zcode-cua-helper-aaaaaaaaaaaaaaaa",
    "zcode-cua-helper-bbbbbbbbbbbbbbbb",
  );
  expect(zcodeCuaBrokerEnv(root)).toEqual({
    ZCODE_CUA_PERMISSION_BROKER_SOCKET: join(
      root,
      "zcode-cua-helper-bbbbbbbbbbbbbbbb",
    ),
  });
});

it("returns no environment when the pipe root cannot be read", () => {
  expect(zcodeCuaBrokerEnv(join(tmpdir(), "missing-zcode-cua-pipes"))).toEqual(
    {},
  );
});
