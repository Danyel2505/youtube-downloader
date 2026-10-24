export const LogScope = {
  Main: "main",
  Isolated: "isolated",
  Background: "bg",
  Iframe: "iframe",
  Capture: "capture",
  PageSabrFetch: "page-sabr-fetch",
  Worker: "worker",
  Ffmpeg: "ffmpeg",
  Transcode: "transcode",
  Popup: "popup",
  Pipeline: "pipeline"
} as const;

export type LogScope = (typeof LogScope)[keyof typeof LogScope];

export const LogLevel = {
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error"
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogEntry = {
  time: number;
  scope: LogScope;
  level: LogLevel;
  message: string;
};

type LogSink = (entry: LogEntry) => void;

const MAX_MESSAGE_LENGTH = 2000;

// null while log capture is off, so a disabled feature never pays for formatting
let logSink: LogSink | null = null;

export function setLogSink(sink: LogSink | null) {
  logSink = sink;
}

function stringifyArgument(argument: unknown) {
  if (typeof argument === "string") {
    return argument;
  }

  if (argument instanceof Error) {
    const hasMessageInStack = argument.stack?.includes(argument.message);
    return hasMessageInStack ? argument.stack! : `${argument.name}: ${argument.message}\n${argument.stack ?? ""}`;
  }

  try {
    return JSON.stringify(argument) ?? String(argument);
  } catch {
    return String(argument);
  }
}

export function forwardLogEntry(entry: LogEntry) {
  logSink?.(entry);
}

type EmitToSinkParams = {
  scope: LogScope;
  level: LogLevel;
  args: unknown[];
};
export function emitToLogSink({ scope, level, args }: EmitToSinkParams) {
  logSink?.({
    time: Date.now(),
    scope,
    level,
    message: args.map(stringifyArgument).join(" ").slice(0, MAX_MESSAGE_LENGTH)
  });
}

export function createLogger(scope: LogScope) {
  const prefix = `[ytdl:${scope}]`;
  return {
    debug(...args: unknown[]) {
      console.debug(prefix, ...args);
      emitToLogSink({
        scope,
        level: LogLevel.Debug,
        args
      });
    },
    info(...args: unknown[]) {
      console.info(prefix, ...args);
      emitToLogSink({
        scope,
        level: LogLevel.Info,
        args
      });
    },
    warn(...args: unknown[]) {
      console.warn(prefix, ...args);
      emitToLogSink({
        scope,
        level: LogLevel.Warn,
        args
      });
    },
    error(...args: unknown[]) {
      console.error(prefix, ...args);
      emitToLogSink({
        scope,
        level: LogLevel.Error,
        args
      });
    }
  };
}
