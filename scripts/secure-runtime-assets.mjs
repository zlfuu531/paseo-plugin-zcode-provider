import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const KEYRING_PACKAGES = [
  "keyring",
  "keyring-darwin-arm64",
  "keyring-linux-x64-gnu",
  "keyring-linux-arm64-gnu",
  "keyring-win32-x64-msvc",
  "keyring-win32-arm64-msvc",
];

export function verifyWindowsHelper(bytes, arch) {
  const header = bytes.length >= 64 ? bytes.readUInt32LE(60) : -1;
  if (
    bytes.toString("ascii", 0, 2) !== "MZ" ||
    header < 0 ||
    header + 6 > bytes.length ||
    bytes.toString("ascii", header, header + 4) !== "PE\0\0" ||
    bytes.readUInt16LE(header + 4) !== (arch === "arm64" ? 0xaa64 : 0x8664)
  )
    throw new Error(`Invalid Windows ${arch} runtime helper`);
}

export function windowsHelperSourceDigests(parts) {
  // Git may check out the same pinned C++ sources as LF on Linux and CRLF on
  // Windows. The official helper build records raw bytes, so accept exactly
  // those two newline encodings of the same source, not arbitrary changes.
  const lf = parts.map((bytes) =>
    bytes.toString("utf8").replace(/\r\n/g, "\n"),
  );
  return new Set([
    digest(Buffer.from(lf.join(""))),
    digest(Buffer.from(lf.map((text) => text.replace(/\n/g, "\r\n")).join(""))),
  ]);
}

export function lockedKeyringIntegrity(lock, name) {
  const escaped = `@napi-rs/${name}@2.1.2`.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const match = lock.match(
    new RegExp(
      `['"]?${escaped}['"]?:\\r?\\n\\s+resolution: \\{integrity: (sha512-[^}\\s]+)\\}`,
    ),
  );
  if (!match) throw new Error(`Missing locked integrity for @napi-rs/${name}`);
  return match[1];
}

async function stageKeyring(source, root) {
  const lock = await readFile(join(source, "pnpm-lock.yaml"), "utf8");
  const directory = await mkdtemp(join(tmpdir(), "zcode-keyring-package-"));
  try {
    for (const name of KEYRING_PACKAGES) {
      const integrity = lockedKeyringIntegrity(lock, name);
      const response = await fetch(
        `https://registry.npmjs.org/@napi-rs/${name}/2.1.2`,
      );
      if (!response.ok)
        throw new Error(`Cannot resolve keyring package ${name}`);
      const metadata = await response.json();
      if (
        metadata.dist.integrity !== integrity ||
        !metadata.dist.tarball.startsWith(
          "https://registry.npmjs.org/@napi-rs/",
        )
      )
        throw new Error(`Keyring package ${name} differs from the source lock`);
      const archive = await fetch(metadata.dist.tarball);
      if (!archive.ok)
        throw new Error(`Cannot download keyring package ${name}`);
      const bytes = Buffer.from(await archive.arrayBuffer());
      if (
        `sha512-${createHash("sha512").update(bytes).digest("base64")}` !==
        integrity
      )
        throw new Error(`Keyring package ${name} failed its integrity check`);
      const staging = join(directory, name);
      await mkdir(staging);
      const path = join(staging, "archive.tgz");
      await writeFile(path, bytes);
      execFileSync("tar", ["-xzf", path, "-C", staging]);
      for (const base of [root, join(root, "agent")]) {
        const target = join(base, "node_modules/@napi-rs", name);
        await mkdir(join(target, ".."), { recursive: true });
        await cp(join(staging, "package"), target, { recursive: true });
      }
    }
  } finally {
    if (
      resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`) &&
      basename(directory).startsWith("zcode-keyring-package-")
    )
      await rm(directory, { recursive: true, force: true });
  }
}

export async function stageSecureRuntimeAssets({ source, root, windowsHosts }) {
  if (!windowsHosts)
    throw new Error(
      "ZCode 3.18 packaging requires both Windows runtime helpers",
    );
  await stageKeyring(source, root);
  const expectedSources = windowsHelperSourceDigests(
    await Promise.all(
      ["main.cpp", "CMakeLists.txt"].map((file) =>
        readFile(join(source, "scripts/windows-runtime-host", file)),
      ),
    ),
  );
  for (const arch of ["x64", "arm64"]) {
    const input = join(windowsHosts, `windows-host-${arch}`);
    const bytes = await readFile(join(input, "zcode-runtime-host.exe"));
    verifyWindowsHelper(bytes, arch);
    const manifest = JSON.parse(
      await readFile(join(input, "build.json"), "utf8"),
    );
    if (
      !expectedSources.has(manifest.source) ||
      manifest.binary !== digest(bytes)
    )
      throw new Error(`Windows ${arch} helper source or binary hash differs`);
    const output = join(root, "tools/runtime-host", `win32-${arch}`);
    await mkdir(output, { recursive: true });
    for (const file of ["zcode-runtime-host.exe", "build.json"])
      await cp(join(input, file), join(output, file));
  }
}
