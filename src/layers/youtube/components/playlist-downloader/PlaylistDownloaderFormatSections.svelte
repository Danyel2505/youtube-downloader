<script lang="ts">
  import PolymerSelect from "../polymer-select/PolymerSelect.svelte";
  import type { createPlaylistDownloaderState } from "./PlaylistDownloader.state.svelte";
  import PlaylistOverrideBadge from "./PlaylistOverrideBadge.svelte";
  import PlaylistResetLink from "./PlaylistResetLink.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { toInlineLabeledOption } from "@/lib/utils/choices";
  import { listContainerChoices } from "@/lib/utils/containers";
  import { DownloadType, VideoQualityMode } from "@/types";

  interface Props {
    playlist: ReturnType<typeof createPlaylistDownloaderState>;
  }

  const { playlist }: Props = $props();

  const videoExtOptions = $derived(listContainerChoices("video").map(toInlineLabeledOption));
  const audioExtOptions = $derived(listContainerChoices("audio").map(toInlineLabeledOption));
  const qualityOptions = $derived([
    {
      value: VideoQualityMode.Best,
      label: t("Best quality")
    },
    ...playlist.availableQualities.map(height => ({
      value: String(height),
      label: !playlist.isRevealingAll && height <= playlist.guaranteedQuality ? `${height}p` : t("Up to {height}p", { height })
    }))
  ]);

  const isVideoTypeDisabled = $derived(playlist.effectiveDownloadType === DownloadType.Audio);
  const isAudioExtTypeDisabled = $derived(playlist.effectiveDownloadType === DownloadType.Video);
  const isVideoExtDisabled = $derived(isVideoTypeDisabled || playlist.isDownloading);
  const isAudioExtDisabled = $derived(isAudioExtTypeDisabled || playlist.isDownloading);
  const isQualityDisabled = $derived(isVideoTypeDisabled || playlist.isDownloading);
</script>

<div class="ytdl-section ytdl-section-select" class:is-disabled={isVideoTypeDisabled}>
  <PolymerSelect
    id="playlist-video-quality"
    disabled={isQualityDisabled}
    label={t("Video quality")}
    onchange={value => (playlist.effectiveQuality = value)}
    options={qualityOptions}
    value={playlist.effectiveQuality}
  />
  {#if playlist.isQualityOverridden}
    <PlaylistOverrideBadge />
  {/if}
</div>

<div class="ytdl-section ytdl-section-select" class:is-disabled={isVideoTypeDisabled}>
  <PolymerSelect
    id="playlist-video-ext"
    disabled={isVideoExtDisabled}
    label={t("Video format")}
    onchange={value => (playlist.effectiveVideoExt = value)}
    options={videoExtOptions}
    value={playlist.effectiveVideoExt}
  />
  {#if playlist.isVideoExtOverridden}
    <PlaylistOverrideBadge />
  {/if}
</div>

<div class="ytdl-section ytdl-section-select" class:is-disabled={isAudioExtTypeDisabled}>
  <PolymerSelect
    id="playlist-audio-ext"
    disabled={isAudioExtDisabled}
    label={t("Audio format")}
    onchange={value => (playlist.effectiveAudioExt = value)}
    options={audioExtOptions}
    value={playlist.effectiveAudioExt}
  />
  {#if playlist.isAudioExtOverridden}
    <PlaylistOverrideBadge />
  {/if}
</div>

<PlaylistResetLink
  isDisabled={playlist.isDownloading}
  isVisible={playlist.isAnyOverrideActive}
  onclick={playlist.resetOverrides}
/>

<style>
  .ytdl-section-select {
    position: relative;
  }

  .ytdl-section.is-disabled {
    opacity: 50%;
    pointer-events: none;
  }

  :global(.ytdl-section-select .ytdl-override-badge) {
    position: absolute;
    top: 14px;
    left: 12px;
  }
</style>
