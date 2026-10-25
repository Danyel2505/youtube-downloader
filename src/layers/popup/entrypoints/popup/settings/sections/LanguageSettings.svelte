<script lang="ts">
  import type { SettingsProps } from "../settings-props";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { LanguagePreference } from "@/types";

  const { options }: SettingsProps = $props();

  // Each language is written in itself, so it stays readable after a wrong pick
  const languageOptions = $derived([
    {
      value: LanguagePreference.Auto,
      label: t("Automatic"),
      description: t("Follows your browser's language")
    },
    {
      value: LanguagePreference.English,
      label: "English"
    },
    {
      value: LanguagePreference.SpanishLatinAmerica,
      label: "Español (Latinoamérica)"
    }
  ] as const);
</script>

<SettingsGroup title={t("Language")}>
  <SettingsRadioGroup
    name="interface-language"
    isLegendHidden
    legend={t("Language")}
    onchange={value => {
      void setOption({
        key: "language",
        value
      });
    }}
    options={languageOptions}
    selected={options.language}
  />
</SettingsGroup>
