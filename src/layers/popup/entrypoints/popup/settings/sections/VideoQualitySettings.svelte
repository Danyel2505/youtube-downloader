<script lang="ts">
  import sparkleIcon from "../../icons/sparkle.svg?raw";
  import type { SlidingSettingsProps } from "../settings-props";
  import SettingsDropDown from "../ui/SettingsDropDown.svelte";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import SettingsSwitch from "../ui/SettingsSwitch.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { findChoice } from "@/lib/utils/choices";
  import { MAX_FRAME_RATE_CHOICES } from "@/lib/youtube/select-video-quality";
  import { VIDEO_QUALITIES } from "@/lib/youtube/video-helpers";
  import { VideoQualityMode } from "@/types";
  import { slide } from "svelte/transition";

  const { options, slideDuration }: SlidingSettingsProps = $props();

  const QUALITY_SUBLABELS: Record<number, string> = {
    4320: "8K",
    2160: "4K",
    1440: "2K",
    1080: "Full HD",
    720: "HD",
    480: "SD"
  };

  const qualityModeOptions = $derived([
    {
      value: VideoQualityMode.CurrentQuality,
      label: t("Match current player quality")
    },
    {
      value: VideoQualityMode.Best,
      label: t("Best available quality"),
      sub: enhancedBitrate
    },
    {
      value: VideoQualityMode.Custom,
      label: t("Custom quality"),
      sub: customQuality
    }
  ] as const);

  const customQualityItems = $derived(
    VIDEO_QUALITIES.map(quality => ({
      value: String(quality),
      label: `${quality}p`,
      description: QUALITY_SUBLABELS[quality]
    }))
  );
</script>

{#snippet enhancedBitrate()}
  <label class="enhanced-bitrate">
    <div class="enhanced-bitrate-txt">
      <span class="enhanced-bitrate-title">{t("Enhanced bitrate")}</span>
      <span class="premium-badge">
        {@html sparkleIcon}
        {t("YouTube Premium")}
      </span>
      <span class="enhanced-bitrate-desc">{t("Grab the higher-bitrate stream whenever YouTube offers it")}</span>
    </div>
    <SettingsSwitch
      isChecked={options.enhancedBitrate}
      onchange={isChecked => {
        void setOption({
          key: "enhancedBitrate",
          value: isChecked
        });
      }}
    />
  </label>
{/snippet}

{#snippet customQuality()}
  <SettingsDropDown
    currentValue={String(options.videoQuality)}
    displayValue={`${options.videoQuality}p`}
    items={customQualityItems}
    label={t("Quality")}
    onSelect={selected => {
      void setOption({
        key: "videoQuality",
        value: Number(selected)
      });
    }}
    {slideDuration}
  />
{/snippet}

<SettingsGroup title={t("Video quality")}>
  <SettingsRadioGroup
    name="quality-mode"
    isLegendHidden
    legend={t("Video quality")}
    onchange={value => {
      void setOption({
        key: "videoQualityMode",
        value
      });
    }}
    options={qualityModeOptions}
    selected={options.videoQualityMode}
    {slideDuration}
  />
  {#if options.videoQualityMode !== VideoQualityMode.CurrentQuality}
    <div transition:slide={{ duration: slideDuration }}>
      <SettingsDropDown
        currentValue={options.maxFrameRate}
        displayValue={findChoice(MAX_FRAME_RATE_CHOICES, options.maxFrameRate)?.label ?? options.maxFrameRate}
        items={MAX_FRAME_RATE_CHOICES}
        label={t("Max frame rate")}
        onSelect={selected => {
          const choice = findChoice(MAX_FRAME_RATE_CHOICES, selected);
          if (choice) {
            void setOption({
              key: "maxFrameRate",
              value: choice.value
            });
          }
        }}
        {slideDuration}
        subtitle={t("Falls back when a video has nothing under it")}
      />
    </div>
  {/if}
</SettingsGroup>

<style>
  .enhanced-bitrate {
    display: flex;
    gap: 12px;
    align-items: center;
    padding-block: 8px;
    cursor: pointer;
  }

  .enhanced-bitrate-txt {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .enhanced-bitrate-title {
    color: var(--fg);
    font-weight: 600;
    font-size: 0.84375rem;
  }

  .enhanced-bitrate-desc {
    color: var(--fg-muted);
    font-size: 0.71875rem;
    line-height: 1.35;
  }

  .premium-badge {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    align-self: flex-start;
    padding: 2px 8px;
    border: 1px solid color-mix(in oklab, var(--premium) 60%, transparent);
    border-radius: 999px;
    background: color-mix(in oklab, var(--premium) 12%, transparent);
    color: var(--premium);
    font-weight: 600;
    font-size: 0.6875rem;
    letter-spacing: 0.01em;

    :global(svg) {
      width: 12px;
      height: 12px;
    }
  }
</style>
