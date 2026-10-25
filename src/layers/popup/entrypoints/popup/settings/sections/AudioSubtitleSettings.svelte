<script lang="ts">
  import audioVolumeIcon from "../../icons/audio-volume.svg?raw";
  import captionsIcon from "../../icons/captions.svg?raw";
  import sparkleIcon from "../../icons/sparkle.svg?raw";
  import type { SlidingSettingsProps } from "../settings-props";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsSwitchRow from "../ui/SettingsSwitchRow.svelte";
  import AudioLanguagesSection from "./AudioLanguagesSection.svelte";
  import AudioTrackSection from "./AudioTrackSection.svelte";
  import CaptionLanguageSection from "./CaptionLanguageSection.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";

  const { options, slideDuration }: SlidingSettingsProps = $props();
</script>

<SettingsGroup title={t("Audio & subtitles")}>
  <SettingsSwitchRow
    icon={captionsIcon}
    isAccent
    isChecked={options.downloadExtras}
    label={t("Download additional audio tracks and captions")}
    onchange={isChecked => {
      void setOption({
        key: "downloadExtras",
        value: isChecked
      });
    }}
  />
  <SettingsSwitchRow
    icon={audioVolumeIcon}
    isChecked={options.includeAutoDubbing}
    label={t("Include auto-dubbed audio tracks")}
    onchange={isChecked => {
      void setOption({
        key: "includeAutoDubbing",
        value: isChecked
      });
    }}
  />
  <SettingsSwitchRow
    icon={sparkleIcon}
    isChecked={options.includeAiCaptions}
    label={t("Include AI-generated captions")}
    onchange={isChecked => {
      void setOption({
        key: "includeAiCaptions",
        value: isChecked
      });
    }}
  />
  <AudioTrackSection {options} {slideDuration} />
  <AudioLanguagesSection {options} />
  <CaptionLanguageSection {options} />
</SettingsGroup>
