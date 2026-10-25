import type { ButtonViewState } from "./watch-button-types";
import { t } from "@/lib/i18n/i18n.svelte.ts";
import { describeActivity } from "@/lib/youtube/progress-label";
import { ProgressType } from "@/types";

export type { ButtonViewState } from "./watch-button-types";

export function buildDownloadTitle(state: ButtonViewState) {
  const {
    isDone, isDownloading, isError, isUnavailable, isInterrupted, isDownloadable, downloadProgress, progressType, stage
  } = state;
  const isProcessing = isDownloading && progressType === ProgressType.FFmpeg;
  if (!isDownloadable) {
    return {
      title: t("Not downloadable"),
      accessibilityText: t("Not downloadable")
    };
  }

  if (isUnavailable) {
    return {
      title: t("Unavailable"),
      accessibilityText: t("Video unavailable - may have been removed")
    };
  }

  if (isDone) {
    return {
      title: t("Download again"),
      accessibilityText: t("Download again")
    };
  }

  if (isProcessing) {
    return {
      title: downloadProgress,
      accessibilityText: t("{progress} - {activity}, click to cancel", {
        progress: downloadProgress,
        activity: describeActivity({
          progressType,
          stage,
          progress: 1
        })
      })
    };
  }

  if (isDownloading) {
    return {
      title: downloadProgress,
      accessibilityText: t("Stop download - {progress} downloaded", { progress: downloadProgress })
    };
  }

  if (isInterrupted) {
    return {
      title: downloadProgress,
      accessibilityText: t("Stop - paused at {progress}", { progress: downloadProgress })
    };
  }

  if (isError) {
    return {
      title: t("Retry"),
      accessibilityText: t("Retry download")
    };
  }

  return {
    title: t("Download"),
    accessibilityText: t("Download")
  };
}

export function buildDownloadTooltip(state: ButtonViewState) {
  const {
    isDone, isDownloading, isError, isUnavailable, isInterrupted, isDownloadable, isProgressNonZero,
    downloadProgress, progressType, stage, filename, quality
  } = state;
  if (!isDownloadable) {
    return "";
  }

  if (isUnavailable) {
    return t("{name} - unavailable, may have been removed", { name: quality ? `${filename} - ${quality}` : filename });
  }

  const isProcessing = isDownloading && progressType === ProgressType.FFmpeg;
  const isPreparingDownload = isDownloading && !isProgressNonZero;
  const isActivelyDownloading = isDownloading && isProgressNonZero;
  const base = quality ? `${filename} - ${quality}` : filename;
  if (isDone) {
    return base;
  }

  if (isError) {
    return t("{name} - retry", { name: base });
  }

  if (isInterrupted) {
    const hasInterruptedProgress = downloadProgress !== "0%";
    return hasInterruptedProgress
      ? t("{name} - paused at {progress}", {
        name: base,
        progress: downloadProgress
      })
      : base;
  }

  if (isProcessing) {
    return t("{name} - {progress} ({activity}), click to cancel", {
      name: base,
      progress: downloadProgress,
      activity: describeActivity({
        progressType,
        stage,
        progress: 1
      })
    });
  }

  if (isPreparingDownload) {
    return t("{name} - preparing", { name: base });
  }

  if (isActivelyDownloading) {
    return t("{name} - {progress} downloaded", {
      name: base,
      progress: downloadProgress
    });
  }

  return base;
}
