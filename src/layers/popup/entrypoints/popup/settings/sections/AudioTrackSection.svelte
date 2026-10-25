<script lang="ts">
  import type { SlidingSettingsProps } from "../settings-props";
  import SettingsDropDown from "../ui/SettingsDropDown.svelte";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { AudioTrackLanguageMode } from "@/types";
  import { getLanguageName, LANGUAGES } from "#popup/lib/languages";

  const { options, slideDuration }: SlidingSettingsProps = $props();

  const languageItems = $derived(
    LANGUAGES.map(([name, code]) => ({
      value: code,
      label: getLanguageName({
        name,
        code
      })
    }))
  );
  const customLanguageName = $derived(
    languageItems.find(({ value }) => value === options.customLanguage)?.label ?? options.customLanguage
  );

  const languageModeOptions = $derived([
    {
      value: AudioTrackLanguageMode.OriginalLanguage,
      label: t("Original language"),
      description: t("Uses the video's native/untagged audio track; falls back to video language then YouTube's language")
    },
    {
      value: AudioTrackLanguageMode.MatchVideo,
      label: t("Match selected track"),
      description: t("Uses the video's current audio track on watch pages, or YouTube's language elsewhere")
    },
    {
      value: AudioTrackLanguageMode.Custom,
      label: t("Custom language"),
      description: t("Falls back to English if the language is unavailable"),
      sub: customLanguage
    }
  ] as const);
</script>

{#snippet customLanguage()}
  <SettingsDropDown
    currentValue={options.customLanguage}
    displayValue={customLanguageName}
    items={languageItems}
    label={t("Language")}
    onSelect={selected => {
      void setOption({
        key: "customLanguage",
        value: selected
      });
    }}
    {slideDuration}
  />
{/snippet}

<SettingsRadioGroup
  name="language-mode"
  legend={t("Audio track language")}
  onchange={value => {
    void setOption({
      key: "audioTrackLanguageMode",
      value
    });
  }}
  options={languageModeOptions}
  selected={options.audioTrackLanguageMode}
  {slideDuration}
/>
