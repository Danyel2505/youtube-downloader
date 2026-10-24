import { redactSecrets } from "@/lib/logs/redact-secrets";
import { MessageType, onMessage } from "@/lib/messaging/messaging";
import { logEntriesItem, optionsItem } from "@/lib/storage/storage";
import type { LogEntry } from "@/lib/utils/logger";
import type { Options } from "@/types";

const MAX_LOG_ENTRIES = 2000;
const LOG_SEPARATOR = "-".repeat(60);

let isLogsEnabled = false;
let entriesPromise: Promise<LogEntry[]> | null = null;
let isFlushing = false;
let isDirty = false;

function loadEntries() {
  entriesPromise ??= logEntriesItem.getValue();
  return entriesPromise;
}

// Writes coalesce while one is in flight, so a burst of lines costs a couple of writes
async function flush() {
  isDirty = true;

  if (isFlushing) {
    return;
  }

  isFlushing = true;
  while (isDirty) {
    isDirty = false;
    await logEntriesItem.setValue(await loadEntries()).catch(() => {});
  }

  isFlushing = false;
}

function applyOptions(options: Partial<Options> | null) {
  isLogsEnabled = !!options?.isLogsEnabled;
}

const settingReady = optionsItem.getValue().then(applyOptions, () => {});
optionsItem.watch(applyOptions);

export async function appendLog(entry: LogEntry) {
  await settingReady;

  if (!isLogsEnabled) {
    return;
  }

  const entries = await loadEntries();
  entries.push({
    ...entry,
    message: redactSecrets(entry.message)
  });
  entries.splice(0, Math.max(0, entries.length - MAX_LOG_ENTRIES));
  await flush();
}

function formatEntry({ time, scope, level, message }: LogEntry) {
  return `${new Date(time).toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
}

async function buildLogs() {
  const entries = await loadEntries();
  const options = await optionsItem.getValue();
  const { name, version } = browser.runtime.getManifest();
  const header = [
    `${name} logs`,
    `Version: ${version}`,
    `Generated: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `CPU threads: ${navigator.hardwareConcurrency}`,
    `Options: ${JSON.stringify(options)}`,
    `Entries: ${entries.length}`,
    LOG_SEPARATOR
  ];
  const lines = entries.toSorted((entryA, entryB) => entryA.time - entryB.time).map(formatEntry);
  return {
    report: [...header, ...lines].join("\n"),
    entryCount: entries.length
  };
}

export function registerLogHandlers() {
  onMessage(MessageType.AppendLog, ({ data }) => appendLog(data));
  onMessage(MessageType.GetLogs, () => buildLogs());
  onMessage(MessageType.ClearLogs, async () => {
    const entries = await loadEntries();
    entries.length = 0;
    await flush();
  });
}
