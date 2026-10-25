<script lang="ts">
  import type { createPlaylistActionButtons } from "./PlaylistDownloader.action-buttons.svelte";
  import type { createPlaylistDownloaderState } from "./PlaylistDownloader.state.svelte";
  import PlaylistDownloaderSelectRow from "./PlaylistDownloaderSelectRow.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { applyPolymerCustomStyles, PAPER_PROGRESS_THEME } from "@/lib/ui/polymer-utils";

  interface Props {
    playlist: ReturnType<typeof createPlaylistDownloaderState>;
    actionButtons: ReturnType<typeof createPlaylistActionButtons>;
  }

  const { playlist, actionButtons }: Props = $props();

  function attachProgressBar(elProgress: Element): void {
    applyPolymerCustomStyles({
      element: elProgress,
      styles: PAPER_PROGRESS_THEME
    });
  }

  const progressAriaLabel = $derived.by(() => {
    if (playlist.isRevealingAll) {
      return t("Loading playlist: {count} videos found", { count: playlist.revealedVideoCount });
    }

    if (playlist.isDownloading) {
      return t("Downloading {done} of {total} videos", {
        done: playlist.downloadedCount,
        total: playlist.totalCount
      });
    }

    const count = playlist.activeIndividualDownloadCount;
    return t(count === 1 ? "Downloading {count} video" : "Downloading {count} videos", { count });
  });

  const progressAriaValueText = $derived.by(() => {
    if (playlist.isRevealingAll) {
      return t("{count} videos found", { count: playlist.revealedVideoCount });
    }

    if (playlist.isDownloading) {
      return t("{done} of {total} complete", {
        done: playlist.downloadedCount,
        total: playlist.totalCount
      });
    }

    const count = playlist.activeIndividualDownloadCount;
    return t(count === 1 ? "{count} video in progress" : "{count} videos in progress", { count });
  });

  const isActiveBatchDownload = $derived(playlist.isDownloading && playlist.totalCount > 0);
  const isIndividualDownloadsPresent = $derived(playlist.activeIndividualDownloadCount > 0);
  const isBatchProgressPresent = $derived(playlist.completedBatchProgress > 0);
  const isProgressVisible = $derived(
    playlist.isRevealingAll
    || isActiveBatchDownload
    || isIndividualDownloadsPresent
    || isBatchProgressPresent
  );
</script>

{#if playlist.error}
  <div class="ytdl-error-banner" role="alert">{playlist.error}</div>
{/if}

<div class="ytdl-playlist-actions">
  {#if !playlist.isDownloading}
    <PlaylistDownloaderSelectRow {actionButtons} {playlist} />
  {/if}

  {#if isProgressVisible}
    {#if playlist.currentPhaseLabel}
      <span class="ytdl-phase-label" aria-live="polite">{playlist.currentPhaseLabel}</span>
    {/if}
    <tp-yt-paper-progress
      {@attach attachProgressBar}
      aria-label={progressAriaLabel}
      aria-valuetext={progressAriaValueText}
      indeterminate={playlist.isRevealingAll || playlist.totalProgress === 0 || undefined}
      value={Math.round(playlist.totalProgress)}
    ></tp-yt-paper-progress>
  {/if}
</div>

{#if playlist.nonDownloadableCount > 0}
  <p class="ytdl-restriction-notice" role="status">
    <span class="ytdl-restriction-icon" aria-hidden="true">i</span>
    {playlist.nonDownloadableCount === 1
      ? t("{count} video not downloadable (private or restricted)", { count: playlist.nonDownloadableCount })
      : t("{count} videos not downloadable (private or restricted)", { count: playlist.nonDownloadableCount })}
  </p>
{/if}

<style>
  :global(.ytdl-error-banner) {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--yt-sys-color-baseline--error-indicator, rgb(204 0 0));
    color: #ffffff;
    font-size: 1.3rem;
  }

  .ytdl-playlist-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;

    & :global(tp-yt-paper-progress) {
      width: 100%;
    }
  }

  .ytdl-phase-label {
    overflow: hidden;
    color: var(--yt-sys-color-baseline--text-secondary, #aaaaaa);
    font-size: 1.2rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ytdl-restriction-notice {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    color: var(--yt-sys-color-baseline--text-secondary, #aaaaaa);
    font-size: 1.2rem;
  }

  .ytdl-restriction-icon {
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    width: 16px;
    height: 16px;
    border: 1px solid currentColor;
    border-radius: 50%;
    font-family: serif;
    font-style: italic;
    font-weight: 700;
    font-size: 1.1rem;
    line-height: 1;
  }
</style>
