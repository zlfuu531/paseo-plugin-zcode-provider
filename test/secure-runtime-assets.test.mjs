import { expect, test } from "vitest";
import {
  lockedKeyringIntegrity,
  verifyWindowsHelper,
} from "../scripts/secure-runtime-assets.mjs";

test("uses the exact keyring package and integrity from the source lock", () => {
  const lock =
    "  '@napi-rs/keyring-win32-x64-msvc@2.1.2':\n    resolution: {integrity: sha512-fixture}\n";
  expect(lockedKeyringIntegrity(lock, "keyring-win32-x64-msvc")).toBe(
    "sha512-fixture",
  );
  expect(() =>
    lockedKeyringIntegrity(lock, "keyring-win32-arm64-msvc"),
  ).toThrow();
  expect(() =>
    lockedKeyringIntegrity(
      lock.replace("2.1.2", "2.1.1"),
      "keyring-win32-x64-msvc",
    ),
  ).toThrow();
});

test("rejects malformed and wrong-architecture Windows helper binaries", () => {
  const bytes = Buffer.alloc(128);
  bytes.write("MZ");
  bytes.writeUInt32LE(64, 60);
  bytes.write("PE\0\0", 64);
  bytes.writeUInt16LE(0x8664, 68);
  expect(() => verifyWindowsHelper(bytes, "x64")).not.toThrow();
  expect(() => verifyWindowsHelper(bytes, "arm64")).toThrow();
  expect(() => verifyWindowsHelper(Buffer.from("invalid"), "x64")).toThrow();
});
