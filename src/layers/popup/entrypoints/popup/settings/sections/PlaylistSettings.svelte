<script lang="ts">
  import expandVerticalIcon from "../../icons/expand-vertical.svg?raw";
  import type { SettingsProps } from "../settings-props";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsRadioGroup from "../ui/SettingsRadioGroup.svelte";
  import SettingsSwitchRow from "../ui/SettingsSwitchRow.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { PlaylistDownloadMode, PlaylistOutputMode } from "@/types";

  const { options }: SettingsProps = $props();

  const downloadModeOptions = $derived([
    {
      value: PlaylistDownloadMode.Fast,
      label: t("In parallel")
    },
    {
      value: PlaylistDownloadMode.DataSaver,
      label: t("One at a time")
    }
  ] as const);

  const outputModeOptions = $derived([
    {
      value: PlaylistOutputMode.Individual,
      label: t("Separate files")
    },
    {
      value: PlaylistOutputMode.Zip,
      label: t("Single ZIP")
    }
  ] as const);
</script>

<SettingsGroup title={t("Playlist")}>
  <SettingsRadioGroup
    name="playlist-download-mode"
    legend={t("Download speed")}
    onchange={value => {
      void setOption({
        key: "playlistDownloadMode",
        value
      });
    }}
    options={downloadModeOptions}
    selected={options.playlistDownloadMode}
  />
  <SettingsRadioGroup
    name="playlist-output-mode"
    legend={t("Output - video playlists")}
    onchange={value => {
      void setOption({
        key: "playlistOutputMode",
        value
      });
    }}
    options={outputModeOptions}
    selected={options.playlistOutputMode}
  />
  <SettingsRadioGroup
    name="playlist-audio-output-mode"
    legend={t("Output - audio playlists")}
    onchange={value => {
      void setOption({
        key: "playlistAudioOutputMode",
        value
      });
    }}
    options={outputModeOptions}
    selected={options.playlistAudioOutputMode}
  />
  <SettingsSwitchRow
    icon={expandVerticalIcon}
    isChecked={options.isPlaylistScrollSyncEnabled}
    label={t("Scroll to each video while downloading")}
    onchange={isChecked => {
      void setOption({
        key: "isPlaylistScrollSyncEnabled",
        value: isChecked
      });
    }}
  />
</SettingsGroup>
