import { ensureNamedFilename } from "@/lib/utils/filename";
import { createLogger, LogScope } from "@/lib/utils/logger";

const log = createLogger(LogScope.Background);

const intendedFilenames = new Map<string, string>();
const trackedDownloadIds = new Set<number>();

type DownloadWithFilenameParams = {
  url: string;
  filename: string;
  fallbackName: string;
};
export async function downloadWithFilename({ url, filename, fallbackName }: DownloadWithFilenameParams) {
  const safeFilename = ensureNamedFilename({
    filename,
    fallbackName
  });
  intendedFilenames.set(url, safeFilename);
  const downloadId = await browser.downloads.download({
    url,
    filename: safeFilename
  }).catch((error: unknown) => {
    intendedFilenames.delete(url);
    log.error("downloads.download rejected", {
      filename: safeFilename,
      requestedFilename: filename
    }, error);
    throw error;
  });
  trackedDownloadIds.add(downloadId);
  log.info("Browser download started", {
    downloadId,
    filename: safeFilename,
    requestedFilename: filename
  });
  return downloadId;
}

function logDownloadProgress(delta: Browser.downloads.DownloadDelta) {
  const isTracked = trackedDownloadIds.has(delta.id);
  if (!isTracked) {
    return;
  }

  if (delta.filename?.current) {
    log.info("Browser chose the file path", {
      downloadId: delta.id,
      path: delta.filename.current
    });
  }

  const state = delta.state?.current;
  const isTerminal = state === browser.downloads.State.COMPLETE || state === browser.downloads.State.INTERRUPTED;
  if (!isTerminal) {
    return;
  }

  trackedDownloadIds.delete(delta.id);
  log.info("Browser download finished", {
    downloadId: delta.id,
    state,
    error: delta.error?.current
  });
}

// Chrome can ignore the requested name for blob URLs (it then uses the blob's UUID), so the
// name is also suggested when the browser asks for it
export function registerFilenameEnforcer() {
  browser.downloads.onChanged.addListener(logDownloadProgress);

  if (import.meta.env.FIREFOX) {
    return;
  }

  browser.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const filename = intendedFilenames.get(item.url);
    if (!filename) {
      return;
    }

    intendedFilenames.delete(item.url);
    log.info("Suggesting the file name", {
      downloadId: item.id,
      filename,
      browserProposed: item.filename
    });
    suggest({
      filename,
      conflictAction: "uniquify"
    });
  });
}
