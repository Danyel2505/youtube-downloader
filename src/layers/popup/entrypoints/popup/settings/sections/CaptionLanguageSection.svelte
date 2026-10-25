<script lang="ts">
  import type { SettingsProps } from "../settings-props";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { CaptionLanguageMode } from "@/types";

  const { options }: SettingsProps = $props();

  const captionLanguageModeOptions = $derived([
    {
      value: CaptionLanguageMode.SameAsAudio,
      label: t("Same as audio"),
      description: t("Follows the audio language setting above")
    },
    {
      value: CaptionLanguageMode.OriginalLanguage,
      label: t("Original language"),
      description: t("Prefers the video's native language captions")
    },
    {
      value: CaptionLanguageMode.MatchVideo,
      label: t("Match selected track"),
      description: t("Uses the watch page audio track language, or YouTube's language elsewhere")
    },
    {
      value: CaptionLanguageMode.Custom,
      label: t("Custom language"),
      description: t("Uses the same custom language set for audio above")
    }
  ] as const);
</script>

<SettingsRadioGroup
  name="caption-language-mode"
  legend={t("Closed captions language")}
  onchange={value => {
    void setOption({
      key: "captionLanguageMode",
      value
    });
  }}
  options={captionLanguageModeOptions}
  selected={options.captionLanguageMode}
/>
