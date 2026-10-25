<script lang="ts">
  import type { SettingsProps } from "../settings-props";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { DownloadType } from "@/types";

  const { options }: SettingsProps = $props();

  const downloadTypeOptions = $derived([
    {
      value: DownloadType.Auto,
      label: t("Auto (video for videos, audio for music)")
    },
    {
      value: DownloadType.VideoAndAudio,
      label: t("Always video + audio")
    },
    {
      value: DownloadType.Video,
      label: t("Always video only")
    },
    {
      value: DownloadType.Audio,
      label: t("Always audio only")
    }
  ] as const);
</script>

<SettingsGroup title={t("Download type")}>
  <SettingsRadioGroup
    name="download-type"
    isLegendHidden
    legend={t("Download type")}
    onchange={value => {
      void setOption({
        key: "defaultDownloadType",
        value
      });
    }}
    options={downloadTypeOptions}
    selected={options.defaultDownloadType}
  />
</SettingsGroup>
