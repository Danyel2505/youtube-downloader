<script lang="ts">
  import closeIcon from "../icons/close.svg?raw";
  import openInNewIcon from "../icons/open-in-new.svg?raw";
  import playArrowIcon from "../icons/play-arrow.svg?raw";
  import ThumbnailDuration from "../shared/ThumbnailDuration.svelte";
  import WavyProgress from "../shared/WavyProgress.svelte";
  import { VideoStartState } from "./active-downloads-helpers";
  import { focusOrOpenTab } from "./youtube-tab";
  import { getLocale, t } from "@/lib/i18n/i18n.svelte.ts";
  import { formatPercent } from "@/lib/youtube/progress-label";
  import type { describeConversion } from "@/lib/youtube/progress-label";
  import { resolveDisplayThumbnailUrl } from "@/lib/youtube/thumbnail-url";
  import type { ProgressStage } from "@/types";

  interface Props {
    filename: string;
    progress: number | null;
    progressLabel: string;
    isProcessing: boolean;
    stage?: ProgressStage;
    conversion?: ReturnType<typeof describeConversion>;
    startState?: VideoStartState | null;
    quality?: string;
    videoId?: string;
    title?: string;
    channel?: string;
    lengthSeconds?: number;
    thumbnailUrl?: string;
    downloadedBytes?: number;
    totalBytes?: number;
    bytesPerSecond?: number;
    sourceUrl?: string;
    tabId?: number;
    showTabActions?: boolean;
    oncancel: () => void;
  }

  const {
    filename, progress, progressLabel, isProcessing, stage, conversion, startState, quality, videoId,
    title, channel, lengthSeconds, thumbnailUrl, downloadedBytes, totalBytes, bytesPerSecond,
    sourceUrl, tabId, showTabActions = false, oncancel
  }: Props = $props();

  const BYTES_PER_KB = 1024;
  const BYTES_PER_MB = 1024 * 1024;
  const BYTES_PER_GB = 1024 * 1024 * 1024;

  let isThumbnailBroken = $state(false);

  const resolvedThumbnail = $derived(
    resolveDisplayThumbnailUrl({
      videoId,
      thumbnailUrl
    })
  );

  const displayTitle = $derived(title ?? stripExtension(filename));
  const container = $derived(deriveContainer(filename));

  const isStarting = $derived(
    progress === null
    && (startState === VideoStartState.Starting || startState === VideoStartState.WaitingForFFmpeg)
  );
  const isQueued = $derived(progress === null && startState === VideoStartState.Queued);
  // Converting to H.265 reports real progress, so it gets a bar that fills instead of a spinner
  const isConverting = $derived(!!conversion);
  const isIndeterminate = $derived((isProcessing || isStarting) && !(isConverting && progress !== null));
  const hasByteReadout = $derived(
    !isProcessing
    && downloadedBytes !== undefined
    && downloadedBytes > 0
  );
  const indeterminateStatus = $derived.by(() => {
    if (startState === VideoStartState.WaitingForFFmpeg) {
      return t("Waiting for FFmpeg to start");
    }

    if (isStarting) {
      return t("Getting the download ready");
    }

    return stage ? progressLabel : t("Merging video, audio tracks & captions");
  });

  const percentLabel = $derived(progress !== null ? formatPercent(progress) : "");

  const canShowTabAction = $derived(showTabActions && Boolean(sourceUrl || videoId));
  const hasByline = $derived(Boolean(channel) || canShowTabAction);

  function stripExtension(name: string): string {
    const iDot = name.lastIndexOf(".");
    if (iDot <= 0) {
      return name;
    }

    return name.slice(0, iDot);
  }

  function deriveContainer(name: string): string {
    const iDot = name.lastIndexOf(".");
    if (iDot <= 0 || iDot === name.length - 1) {
      return "";
    }

    return name.slice(iDot + 1).toUpperCase();
  }

  function formatBytes(bytes: number, maximumFractionDigits: number): string {
    const formatter = new Intl.NumberFormat(getLocale(), {
      minimumFractionDigits: maximumFractionDigits === 2 ? 2 : 0,
      maximumFractionDigits
    });
    if (bytes >= BYTES_PER_GB) {
      return `${formatter.format(bytes / BYTES_PER_GB)} GB`;
    }

    if (bytes >= BYTES_PER_MB) {
      return `${formatter.format(bytes / BYTES_PER_MB)} MB`;
    }

    if (bytes >= BYTES_PER_KB) {
      return `${formatter.format(bytes / BYTES_PER_KB)} KB`;
    }

    return `${bytes} B`;
  }

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1) {
      return "";
    }

    const NF_SPEED_MB = new Intl.NumberFormat(getLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    const NF_SPEED_INT = new Intl.NumberFormat(getLocale(), {
      maximumFractionDigits: 0
    });
    if (bytesPerSec >= BYTES_PER_MB) {
      return `${NF_SPEED_MB.format(bytesPerSec / BYTES_PER_MB)} MB/s`;
    }

    if (bytesPerSec >= BYTES_PER_KB) {
      return `${NF_SPEED_INT.format(bytesPerSec / BYTES_PER_KB)} KB/s`;
    }

    return `${NF_SPEED_INT.format(bytesPerSec)} B/s`;
  }

  const byteReadoutParts = $derived.by(() => {
    const parts: string[] = [];
    if (downloadedBytes !== undefined && downloadedBytes > 0) {
      const downloadedStr = formatBytes(downloadedBytes, 0);
      const hasValidTotal = totalBytes !== undefined && totalBytes >= downloadedBytes;
      if (hasValidTotal) {
        parts.push(`${downloadedStr} / ${formatBytes(totalBytes, 2)}`);
      } else {
        parts.push(downloadedStr);
      }
    }

    if (bytesPerSecond !== undefined && bytesPerSecond > 0) {
      const speedStr = formatSpeed(bytesPerSecond);
      if (speedStr) {
        parts.push(speedStr);
      }
    }

    return parts;
  });

  async function focusSourceTab(): Promise<void> {
    if (!videoId) {
      return;
    }

    await focusOrOpenTab({
      videoId,
      tabId,
      sourceUrl
    });
  }
</script>

<article class="dl-card">
  <div class="dl-row">
    {#if canShowTabAction}
      <button
        class="dl-thumb-wrap dl-thumb-wrap-button"
        aria-label={t("Open {title} in source tab", { title: displayTitle })}
        onclick={focusSourceTab}
        type="button"
      >
        {#if resolvedThumbnail && !isThumbnailBroken}
          <img
            class="dl-thumb"
            alt=""
            height="67"
            onerror={() => (isThumbnailBroken = true)}
            src={resolvedThumbnail}
            width="120"
          />
        {:else}
          <div class="dl-thumb dl-thumb-placeholder" aria-hidden="true"></div>
        {/if}
        <span class="dl-thumb-play" aria-hidden="true">
          {@html playArrowIcon}
        </span>
        <ThumbnailDuration {lengthSeconds} />
      </button>
    {:else}
      <div class="dl-thumb-wrap">
        {#if resolvedThumbnail && !isThumbnailBroken}
          <img
            class="dl-thumb"
            alt=""
            height="67"
            onerror={() => (isThumbnailBroken = true)}
            src={resolvedThumbnail}
            width="120"
          />
        {:else}
          <div class="dl-thumb dl-thumb-placeholder" aria-hidden="true"></div>
        {/if}
        <ThumbnailDuration {lengthSeconds} />
      </div>
    {/if}

    <div class="dl-info">
      {#if canShowTabAction}
        <button
          class="dl-title dl-title-button"
          dir="auto"
          onclick={focusSourceTab}
          type="button"
        >{displayTitle}</button>
      {:else}
        <span class="dl-title" dir="auto">{displayTitle}</span>
      {/if}
      {#if hasByline}
        <span class="dl-byline">
          {#if channel}
            <span class="dl-channel" dir="auto">{channel}</span>
          {/if}
          {#if channel && canShowTabAction}
            <span class="dl-byline-sep">·</span>
          {/if}
          {#if canShowTabAction}
            <button class="dl-watch-link" onclick={focusSourceTab} type="button">{t("Watch tab")}</button>
          {/if}
        </span>
      {/if}
      <div class="dl-chips">
        {#if quality}
          <span class="dl-chip dl-chip-accent">{quality}</span>
        {/if}
        {#if container}
          <span class="dl-chip">{container}</span>
        {/if}
      </div>
    </div>

    <div class="dl-actions">
      {#if canShowTabAction}
        <button
          class="dl-action"
          aria-label={t("Open source tab")}
          data-tooltip={t("Open source tab")}
          data-tooltip-align="end"
          onclick={focusSourceTab}
          type="button"
        >
          {@html openInNewIcon}
        </button>
      {/if}
      <button
        class="dl-action dl-cancel"
        aria-label={t("Cancel download of {title}", { title: displayTitle })}
        data-tooltip={t("Cancel download")}
        data-tooltip-align="end"
        onclick={oncancel}
        type="button"
      >
        {@html closeIcon}
      </button>
    </div>
  </div>

  {#if isIndeterminate}
    <div class="dl-prog-bar">
      <WavyProgress indeterminate />
    </div>
    <div class="dl-prog-line">
      <span class="state-pill state-processing">
        <span class="state-spinner" aria-hidden="true"></span>
        {isStarting ? t("Preparing") : t("Processing")}
      </span>
      <span class="dl-prog-stat">{indeterminateStatus}</span>
    </div>
  {:else if isQueued}
    <div class="dl-prog-line">
      <span class="state-pill state-queued">{t("Queued")}</span>
      <span class="dl-prog-stat">{t("Waiting for a free slot")}</span>
    </div>
  {:else if progress !== null}
    <div class="dl-prog-bar">
      <WavyProgress value={progress * 100} />
    </div>
    <div class="dl-prog-line">
      <span class="dl-prog-pct">{percentLabel}</span>
      {#if hasByteReadout && byteReadoutParts.length > 0}
        <span class="dl-prog-stat">{[progressLabel, ...byteReadoutParts].join(" · ")}</span>
      {:else}
        <span class="dl-prog-stat">{progressLabel}</span>
      {/if}
    </div>
  {/if}
  {#if conversion}
    <div class="dl-prog-bar">
      <WavyProgress value={conversion.fraction * 100} />
    </div>
    <div class="dl-prog-line">
      <span class="dl-prog-pct">{formatPercent(conversion.fraction)}</span>
      <span class="dl-conversion-detail">
        <span class="dl-prog-stat">{conversion.label}</span>
        {#if conversion.processor}
          <span class="dl-chip dl-chip-accent">{conversion.processor}</span>
        {/if}
      </span>
    </div>
  {/if}
</article>

<style>
  .dl-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 20px;
    background: var(--surface);
  }

  .dl-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .dl-thumb-wrap {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
    width: 120px;
    height: 67px;
    border-radius: 12px;
    background: var(--surface-high);
  }

  .dl-thumb-wrap-button {
    padding: 0;
    border: none;
    color: inherit;
    cursor: pointer;
    transition: opacity 150ms;

    &:hover,
    &:focus-visible {
      opacity: 90%;
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .dl-thumb {
    display: block;
    object-fit: cover;
    width: 120px;
    height: 67px;
  }

  .dl-thumb-placeholder {
    background: linear-gradient(135deg, var(--surface-high), var(--border));
  }

  .dl-thumb-play {
    position: absolute;
    top: 50%;
    left: 50%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--bg) 85%, transparent);
    color: var(--fg);
    pointer-events: none;
    translate: -50% -50%;

    :global(svg) {
      width: 14px;
      height: 14px;
    }
  }

  .dl-info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .dl-title {
    display: -webkit-box;
    overflow: hidden;
    font-weight: 600;
    font-size: 0.8125rem;
    line-height: 1.35;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .dl-title-button {
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-align: start;
    cursor: pointer;
    transition: color 150ms;

    &:hover {
      color: var(--accent);
    }

    &:focus-visible {
      border-radius: 4px;
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .dl-byline {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: baseline;
    overflow: hidden;
    color: var(--fg-muted);
    font-size: 0.71875rem;
  }

  .dl-byline-sep {
    color: var(--fg-subtle);
  }

  .dl-channel {
    overflow: hidden;
    min-width: 0;
    color: var(--fg-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dl-watch-link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 500;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      border-radius: 4px;
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .dl-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .dl-chip {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    border-radius: 6px;
    background: var(--surface-high);
    color: var(--fg);
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .dl-chip-accent {
    background: var(--accent-container);
  }

  .dl-actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
  }

  .dl-action {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 15px;
    background: transparent;
    color: var(--fg-subtle);
    cursor: pointer;
    transition: background-color 200ms, color 200ms;

    &:hover {
      background: var(--accent-hover);
      color: var(--fg);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .dl-cancel {
    &:hover {
      background: var(--danger-hover);
      color: var(--danger);
    }

    &:focus-visible {
      outline-color: var(--danger);
    }
  }

  .dl-prog-bar {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dl-prog-pct {
    flex-shrink: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  .dl-prog-line {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    align-items: baseline;
  }

  .dl-prog-stat {
    overflow: hidden;
    color: var(--fg-muted);
    font-size: 0.71875rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dl-conversion-detail {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .state-pill {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 4px 8px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .state-processing {
    background: var(--accent-container);
    color: var(--fg);
  }

  .state-spinner {
    width: 10px;
    height: 10px;
    border: 1.5px solid color-mix(in oklab, var(--accent) 30%, transparent);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: dl-spin 700ms linear infinite;
  }

  @keyframes dl-spin {
    to {
      rotate: 360deg;
    }
  }

  .state-queued {
    background: var(--surface-high);
    color: var(--fg-muted);
  }
</style>
