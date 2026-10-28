import { registerCrossWorldHandlers } from "./cross-world-handlers";
import { registerGridDropdownHandlers } from "./grid/grid-dropdown";
import { registerGridTagger } from "./grid/grid-tagger";
import { registerGridVideoDataHandler } from "./grid/grid-video-data";
import { setupIframeSilencer } from "./iframe-silencer";
import { setupAudioTrackWatcher, setupCaptionTrackWatcher } from "./player-watchers";
import type { ShortsPageData } from "./video/capture-dispatch";
import { cancelAllActiveDownloads } from "./video/download";
import { extractPlaylistMetadata, handleNavigateSuccess } from "./video/playlist-metadata";
import { extractAndDispatchVideoData } from "./video/video-data";
import { captureLogsFromPage } from "@/lib/logs/log-capture";
import { CrossWorldMessage, crossWorldMessenger } from "@/lib/messaging/cross-world-messenger";
import { CONTENT_OPTIONS, initContentOptions } from "@/lib/ui/synced-stores.svelte";
import { createLogger, LogScope } from "@/lib/utils/logger";
import type { PlayerResponse } from "@/types";

const log = createLogger(LogScope.Main);

const YTDL_IFRAME_QUERY_PARAM = "ytdl=1";
const EVENT_YT_NAVIGATE_FINISH = "yt-navigate-finish";
const EVENT_YT_NAVIGATE_START = "yt-navigate-start";
const EVENT_PAGEHIDE = "pagehide";
const EVENT_LOAD = "load";

declare global {
  interface Window {
    ytInitialPlayerResponse?: PlayerResponse;
    ytInitialData?: ShortsPageData & {
      currentVideoEndpoint?: {
        watchEndpoint?: { videoId?: string };
      };
      contents?: {
        twoColumnWatchNextResults?: {
          results?: {
            results?: {
              contents?: Array<{
                videoPrimaryInfoRenderer?: {
                  title?: { runs?: Array<{ text?: string }> };
                };
              }>;
            };
          };
        };
      };
      header?: {
        playlistHeaderRenderer?: {
          title?: { simpleText?: string };
          playlistId?: string;
          ownerText?: { runs?: Array<{ text?: string }> };
        };
      };
      metadata?: {
        playlistMetadataRenderer?: { title?: string };
      };
    };
  }
}

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  world: "MAIN",
  allFrames: true,
  async main() {
    const isUnrelatedIframe = self !== top && !location.search.includes(YTDL_IFRAME_QUERY_PARAM);
    if (isUnrelatedIframe) {
      return;
    }

    captureLogsFromPage({
      scope: LogScope.Main,
      isEnabled: () => CONTENT_OPTIONS.isLogsEnabled,
      send(entry) {
        crossWorldMessenger.sendMessage(CrossWorldMessage.AppendLog, entry).catch(() => {});
      }
    });

    if (self !== top) {
      setupIframeSilencer();
    }

    registerCrossWorldHandlers();
    registerGridDropdownHandlers();
    registerGridTagger();
    registerGridVideoDataHandler();

    document.addEventListener(EVENT_YT_NAVIGATE_FINISH, handleNavigateSuccess);
    document.addEventListener(EVENT_YT_NAVIGATE_FINISH, setupAudioTrackWatcher);
    document.addEventListener(EVENT_YT_NAVIGATE_FINISH, setupCaptionTrackWatcher);

    if (self === top) {
      function cancelAllAndNotify() {
        const videoIds = cancelAllActiveDownloads();
        const hasActiveDownloads = videoIds.length > 0;
        if (hasActiveDownloads) {
          crossWorldMessenger.sendMessage(CrossWorldMessage.CancelDownload, { videoIds }).catch(() => {});
        }
      }

      document.addEventListener(EVENT_YT_NAVIGATE_START, cancelAllAndNotify);
      addEventListener(EVENT_PAGEHIDE, cancelAllAndNotify);
    }

    async function initializeOnLoad() {
      log.info("Page script initializing", {
        isIframe: self !== top,
        path: location.pathname
      });
      const options = await crossWorldMessenger.sendMessage(CrossWorldMessage.RequestOptions);
      initContentOptions(options);
      log.info("Page script received the options");
      await extractAndDispatchVideoData();
      extractPlaylistMetadata();
      setupAudioTrackWatcher();
      setupCaptionTrackWatcher();
    }

    const isDocumentReady = document.readyState === "complete";
    function reportInitializationFailure(error: unknown) {
      log.warn("Page script initialization failed", error);
    }

    if (isDocumentReady) {
      initializeOnLoad().catch(reportInitializationFailure);
    } else {
      addEventListener(EVENT_LOAD, () => {
        initializeOnLoad().catch(reportInitializationFailure);
      }, { once: true });
    }
  }
});
