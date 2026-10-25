<script lang="ts">
  import { createFooterState, PrimaryButtonState } from "./DownloadOptionsPanelFooter.svelte.ts";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import type { DownloadType, ProgressStage, ProgressType } from "@/types";
  import { attachViewButton } from "#youtube/lib/ui/panel-button-attachments.svelte";

  interface Props {
    primaryState: PrimaryButtonState;
    displayProgress: number;
    progressType: ProgressType | "";
    stage?: ProgressStage;
    downloadType?: DownloadType;
    scopingClass: string;
    primaryButtonId: string;
    viewButtonId: string;
    getIsDownloadable: () => boolean;
    getIsFilenameValid: () => boolean;
    estimatedSizeLabel: string;
  }

  const {
    primaryState, displayProgress, progressType, stage, downloadType, scopingClass,
    primaryButtonId, viewButtonId, getIsDownloadable, getIsFilenameValid,
    estimatedSizeLabel
  }: Props = $props();

  const isDone = $derived(primaryState === PrimaryButtonState.Done);
  const isFailed = $derived(primaryState === PrimaryButtonState.Failed);
  const isActive = $derived(primaryState === PrimaryButtonState.Downloading || isDone || isFailed);

  const footer = createFooterState({
    get primaryState() {
      return primaryState;
    },
    get displayProgress() {
      return displayProgress;
    },
    get progressType() {
      return progressType;
    },
    get stage() {
      return stage;
    },
    get downloadType() {
      return downloadType;
    },
    get getIsDownloadable() {
      return getIsDownloadable;
    },
    get getIsFilenameValid() {
      return getIsFilenameValid;
    },
    get estimatedSizeLabel() {
      return estimatedSizeLabel;
    }
  });
</script>

<div class="ytdl-panel-footer">
  <div class="ytdl-primary-button-wrapper">
    <yt-button-view-model
      class={scopingClass}
      {@attach footer.attachPrimaryButton}
      data-ytdl-button-id={primaryButtonId}
      role="button"
      tabindex="0"
    ></yt-button-view-model>
  </div>

  <div
    style:visibility={isActive ? null : "hidden"}
    class="ytdl-progress-block"
    class:done={isDone}
    class:failed={isFailed}
  >
    <tp-yt-paper-progress
      class="ytdl-progress-track"
      indeterminate={!isDone && !isFailed && displayProgress === 0 || undefined}
      value={isDone ? 100 : Math.round(displayProgress) || (isFailed ? 100 : 0)}
    ></tp-yt-paper-progress>
    {#if isDone}
      <div class="ytdl-done-row">
        <span class="ytdl-progress-label" role="status">{t("Downloaded")}</span>
        <yt-button-view-model
          class={scopingClass}
          {@attach attachViewButton}
          data-ytdl-button-id={viewButtonId}
          role="button"
          tabindex="0"
        ></yt-button-view-model>
      </div>
    {:else if isFailed}
      <span class="ytdl-progress-label" role="alert">{t("Download failed")}</span>
    {:else}
      <span class="ytdl-progress-label" aria-live="polite">{footer.downloadingLabel}</span>
    {/if}
  </div>
</div>

<style>
  .ytdl-panel-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-block: 16px 20px;
    padding-inline: 24px;
  }

  .ytdl-progress-block {
    --paper-progress-active-color: var(--yt-sys-color-baseline--call-to-action, #065fd4);
    --paper-progress-container-color: var(--yt-sys-color-baseline--tonal-rim, rgb(0 0 0 / 10%));
    --paper-progress-height: 4px;

    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-block-start: 4px;

    &.done {
      --paper-progress-active-color: var(--yt-sys-color-baseline--text-complete, #1e8e3e);
    }

    &.failed {
      --paper-progress-active-color: var(--yt-sys-color-baseline--text-error, #d93025);
    }

    .ytdl-done-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ytdl-progress-track {
      display: block;
      overflow: hidden;
      width: 100%;
      border-radius: 4px;
    }

    .ytdl-progress-label {
      color: var(--yt-sys-color-baseline--text-secondary, #606060);
      font-size: 1.2rem;
      font-variant-numeric: tabular-nums;
    }

    &.done .ytdl-progress-label {
      color: var(--yt-sys-color-baseline--text-complete, #1e8e3e);
    }

    &.failed .ytdl-progress-label {
      color: var(--yt-sys-color-baseline--text-error, #d93025);
    }
  }
</style>
