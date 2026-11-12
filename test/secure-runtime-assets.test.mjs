import { expect, test } from "vitest";
import {
  lockedKeyringIntegrity,
  verifyWindowsHelper,
  windowsHelperSourceDigests,
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

test("accepts only LF and CRLF encodings of the pinned helper source", () => {
  const lf = [Buffer.from("line1\nline2\n"), Buffer.from("project(example)\n")];
  const crlf = lf.map((bytes) =>
    Buffer.from(bytes.toString().replace(/\n/g, "\r\n")),
  );
  expect(windowsHelperSourceDigests(lf)).toEqual(
    windowsHelperSourceDigests(crlf),
  );
  const changed = windowsHelperSourceDigests([Buffer.from("changed\n"), lf[1]]);
  for (const hash of changed)
    expect(windowsHelperSourceDigests(lf).has(hash)).toBe(false);
});
