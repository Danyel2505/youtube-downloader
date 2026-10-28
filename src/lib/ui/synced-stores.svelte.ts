import { setLanguage } from "@/lib/i18n/i18n.svelte.ts";
import {
  createMapMessenger,
  createSignalMessenger,
  createSyncedMap,
  createSyncedSignal
} from "@/lib/ui/synced-signal.svelte";
import { INITIAL_OPTIONS } from "@/lib/youtube/video-helpers";
import type { DownloadProgressEntry, InterruptedDownload, Options, VideoData } from "@/types";

export const CONTENT_OPTIONS = $state<Options>(INITIAL_OPTIONS);

// Messages are structured-cloned, which throws on the reactive proxies that hold the array options
export function snapshotContentOptions() {
  return $state.snapshot(CONTENT_OPTIONS);
}

export function initContentOptions(options: Options) {
  Object.assign(CONTENT_OPTIONS, options);
  setLanguage(options.language);
}

export const sabrCredentials = createSyncedSignal({
  messenger: createSignalMessenger<{
    url: string;
    poToken: string;
  } | null>("sabr-credentials"),
  initial: null
});

export const videoDataStore = createSyncedMap(createMapMessenger<VideoData>("video-data"));
export const videoDataFailedStore = createSyncedMap(createMapMessenger<boolean>("video-data-failed"));

const INITIAL_STATUS_PROGRESS: Record<string, DownloadProgressEntry> = {};
export const statusProgressSignal = createSyncedSignal({
  messenger: createSignalMessenger<Record<string, DownloadProgressEntry>>("status-progress"),
  initial: INITIAL_STATUS_PROGRESS
});

export type DownloadProgressState = DownloadProgressEntry;

export const playlistMetadataSignal = createSyncedSignal({
  messenger: createSignalMessenger<{
    playlistId: string;
    playlistTitle: string;
    playlistOwner: string;
  } | null>("playlist-metadata"),
  initial: null
});

export const interruptedDownloadStore = createSyncedMap(createMapMessenger<InterruptedDownload>("interrupted-download"));
