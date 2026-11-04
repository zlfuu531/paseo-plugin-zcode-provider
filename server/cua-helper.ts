// Start and reuse the official ZCode Desktop Computer Use helper so every
// provider session sees a broker pipe before node_repl starts. The helper is a
// standalone Electron-as-Node process from the Desktop installation; the
// Desktop window itself does not have to stay open.
//
// ZCode's Windows helper currently ships with peer identity verification
// temporarily disabled, so any local process can drive Computer Use. Auto-start
// is enabled by default in this fork; set PASEO_ZCODE_CUA_HELPER=0 to disable.
import {
  execFile,
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, isAbsolute, join } from "node:path";
import type { Logger } from "./logger.js";
import {
  listCuaHelperPipes,
  zcodeCuaBrokerEnv,
  WINDOWS_PIPE_ROOT,
} from "./cua-broker-env.js";

const DESKTOP_ROOT_ENV = "PASEO_ZCODE_DESKTOP";
const HELPER_ENV = "PASEO_ZCODE_CUA_HELPER";
const HELPER_ROOT = "resources/tools/cua-helper";
const HELPER_ENTRY = "dist/windows-helper.js";
const HELPER_ADDON = "build/Release/ax_native.node";
const START_TIMEOUT_MS = 10_000;

let desktopRoot: string | undefined;
let helper: ChildProcess | undefined;
let starting: Promise<Record<string, string>> | undefined;

export function cuaHelperEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment[HELPER_ENV] !== "0";
}

export async function ensureCuaBrokerEnv(
  logger: Logger,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> {
  if (process.platform !== "win32" || !cuaHelperEnabled(environment)) return {};
  const existing = zcodeCuaBrokerEnv();
  if (existing.ZCODE_CUA_PERMISSION_BROKER_SOCKET) return existing;
  starting ??= startHelper(logger, environment).finally(() => {
    starting = undefined;
  });
  return starting;
}

async function startHelper(
  logger: Logger,
  environment: NodeJS.ProcessEnv,
): Promise<Record<string, string>> {
  const root = await resolveDesktopRoot(environment);
  if (!root) {
    logger.log("warn", "zcode.cua_helper.desktop_missing");
    return {};
  }
  const helperRoot = join(root, HELPER_ROOT);
  const executable = join(root, "ZCode.exe");
  const entry = join(helperRoot, HELPER_ENTRY);
  const addon = join(helperRoot, HELPER_ADDON);
  if (!existsSync(executable) || !existsSync(entry) || !existsSync(addon)) {
    logger.log("warn", "zcode.cua_helper.files_missing", { root });
    return {};
  }

  if (helper && helper.exitCode === null) helper.kill();
  helper = undefined;
  const pipeName = `zcode-cua-helper-${randomBytes(8).toString("hex")}`;
  const socket = `${WINDOWS_PIPE_ROOT}${pipeName}`;
  let stderr = "";
  const child = spawn(
    executable,
    [entry, "--socket", socket, "--parent-pid", String(process.pid)],
    {
      cwd: helperRoot,
      env: {
        ...process.env,
        ...environment,
        ELECTRON_RUN_AS_NODE: "1",
        ZCODE_CUA_HELPER_ADDON: addon,
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-4096);
  });
  child.once("error", (error) => {
    logger.log("warn", "zcode.cua_helper.spawn_failed", {
      message: error.message,
    });
  });
  child.once("exit", (code, signal) => {
    if (helper !== child) return;
    helper = undefined;
    logger.log("warn", "zcode.cua_helper.exited", { code, signal });
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (listCuaHelperPipes().includes(pipeName)) {
      helper = child;
      logger.log("info", "zcode.cua_helper.started", { socket });
      const claimed = await claimHelper(socket);
      logger.log(
        claimed ? "info" : "warn",
        claimed ? "zcode.cua_helper.claimed" : "zcode.cua_helper.claim_failed",
        { socket },
      );
      logger.log("warn", "zcode.cua_helper.peer_gate_open", {
        note: "ZCode's Windows CUA helper temporarily disables peer identity verification; any local process can drive Computer Use.",
      });
      if (!isProcessElevated())
        logger.log("warn", "zcode.cua_helper.not_elevated", {
          note: "Paseo is not elevated; Computer Use cannot control elevated windows. Run Paseo as administrator for full control.",
        });
      return { ZCODE_CUA_PERMISSION_BROKER_SOCKET: socket };
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  logger.log("warn", "zcode.cua_helper.start_failed", {
    stderr: stderr.slice(-1000),
  });
  return {};
}

// The helper self-terminates if no client claims it within its startup TTL.
// Claim it now so a session that does not use CUA on its first turn still has a
// broker when the tool is used later. broker_info is the claim marker.
function claimHelper(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(socketPath);
    let timer: NodeJS.Timeout | undefined;
    let buffer = "";
    let settled = false;
    const finish = (claimed: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.destroy();
      resolve(claimed);
    };
    timer = setTimeout(() => finish(false), 3_000);
    timer.unref?.();
    socket.on("error", () => finish(false));
    socket.on("close", () => finish(false));
    socket.on("connect", () => {
      socket.write(
        `${JSON.stringify({ id: 1, method: "authenticate", params: { clientApiVersion: 3 } })}\n`,
      );
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      for (;;) {
        const index = buffer.indexOf("\n");
        if (index < 0) return;
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        let message: { id?: number; ok?: boolean };
        try {
          message = JSON.parse(line) as { id?: number; ok?: boolean };
        } catch {
          continue;
        }
        if (message.ok === false) {
          finish(false);
          return;
        }
        if (message.id === 1) {
          socket.write(
            `${JSON.stringify({ id: 2, method: "broker_info", params: {} })}\n`,
          );
        } else if (message.id === 2) {
          finish(message.ok === true);
          return;
        }
      }
    });
  });
}

async function resolveDesktopRoot(
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (desktopRoot && helperFilesPresent(desktopRoot)) return desktopRoot;
  const configured = environment[DESKTOP_ROOT_ENV]?.trim();
  if (configured && isAbsolute(configured) && helperFilesPresent(configured)) {
    desktopRoot = configured;
    return configured;
  }
  const running = await findRunningDesktopRoot();
  if (running && helperFilesPresent(running)) {
    desktopRoot = running;
    return running;
  }
  for (const candidate of standardDesktopRoots(environment)) {
    if (!helperFilesPresent(candidate)) continue;
    desktopRoot = candidate;
    return candidate;
  }
  return undefined;
}

function helperFilesPresent(root: string): boolean {
  const helperRoot = join(root, HELPER_ROOT);
  return (
    existsSync(join(root, "ZCode.exe")) &&
    existsSync(join(helperRoot, HELPER_ENTRY)) &&
    existsSync(join(helperRoot, HELPER_ADDON))
  );
}

function standardDesktopRoots(environment: NodeJS.ProcessEnv): string[] {
  const local = environment.LOCALAPPDATA;
  const programFiles = environment.PROGRAMFILES;
  const programFilesX86 = environment["PROGRAMFILES(X86)"];
  const programW6432 = environment.ProgramW6432;
  return [
    local && join(local, "Programs", "ZCode"),
    local && join(local, "ZCode"),
    programFiles && join(programFiles, "ZCode"),
    programFilesX86 && join(programFilesX86, "ZCode"),
    programW6432 && join(programW6432, "ZCode"),
  ].filter((value): value is string => Boolean(value));
}

function findRunningDesktopRoot(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-Process -Name ZCode -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)",
      ],
      {
        timeout: 5_000,
        windowsHide: true,
        maxBuffer: 64 * 1024,
        encoding: "utf8",
      },
      (error, stdout) => {
        if (error) {
          resolve(undefined);
          return;
        }
        const path = stdout.trim().split(/\r?\n/)[0]?.trim();
        resolve(path ? dirname(path) : undefined);
      },
    );
  });
}

function isProcessElevated(): boolean {
  if (process.platform !== "win32") return false;
  const result = spawnSync(
    process.env.COMSPEC ?? "cmd.exe",
    ["/d", "/c", "net session"],
    { windowsHide: true, stdio: "ignore" },
  );
  return result.status === 0;
}
