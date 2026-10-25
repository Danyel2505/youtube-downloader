<script lang="ts">
  import audioIcon from "../../icons/audio.svg?raw";
  import videoIcon from "../../icons/video.svg?raw";
  import type { SlidingSettingsProps } from "../settings-props";
  import SettingsDropDown from "../ui/SettingsDropDown.svelte";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { findChoice, type Choice } from "@/lib/utils/choices";
  import {
    AUDIO_CODEC_CHOICES,
    DYNAMIC_RANGE_CHOICES,
    listContainerChoices,
    VIDEO_CODEC_CHOICES,
    type MediaKind
  } from "@/lib/utils/containers";
  import type { Options } from "@/types";

  const { options, slideDuration }: SlidingSettingsProps = $props();

  const CODEC_SUBTITLE = "Used when the container supports it" as const;

  type FormatSettingRow = {
    label: string;
    subtitle?: string;
    icon: string;
    choices: Choice[];
    value: string;
    select: (value: string) => void;
  };

  type ChoiceOptionKey = "videoCodec" | "audioCodec" | "dynamicRange";

  function optionRow<Key extends ChoiceOptionKey>({ key, choices, ...row }: {
    key: Key;
    label: string;
    subtitle?: string;
    icon: string;
    choices: Choice<Options[Key]>[];
  }): FormatSettingRow {
    return {
      ...row,
      choices,
      value: options[key],
      select(value) {
        const choice = findChoice(choices, value);
        if (choice) {
          void setOption({
            key,
            value: choice.value
          });
        }
      }
    };
  }

  function containerRow({ kind, ...row }: {
    kind: MediaKind;
    label: string;
    subtitle?: string;
    icon: string;
  }): FormatSettingRow {
    return {
      ...row,
      choices: listContainerChoices(kind),
      value: options.ext[kind],
      select(value) {
        void setOption({
          key: "ext",
          value: {
            ...options.ext,
            [kind]: value
          }
        });
      }
    };
  }

  const rows = $derived([
    containerRow({
      kind: "video",
      label: t("Video container"),
      icon: videoIcon
    }),
    optionRow({
      key: "videoCodec",
      label: t("Video codec"),
      subtitle: t(CODEC_SUBTITLE),
      icon: videoIcon,
      choices: VIDEO_CODEC_CHOICES
    }),
    optionRow({
      key: "dynamicRange",
      label: t("Dynamic range"),
      subtitle: t("HDR comes in VP9 and AV1"),
      icon: videoIcon,
      choices: DYNAMIC_RANGE_CHOICES
    }),
    optionRow({
      key: "audioCodec",
      label: t("Audio codec"),
      subtitle: t(CODEC_SUBTITLE),
      icon: audioIcon,
      choices: AUDIO_CODEC_CHOICES
    }),
    containerRow({
      kind: "audio",
      label: t("Audio container"),
      subtitle: t("Used for audio-only downloads"),
      icon: audioIcon
    })
  ]);
</script>

<SettingsGroup title={t("Format")}>
  {#each rows as row (row.label)}
    <SettingsDropDown
      currentValue={row.value}
      displayValue={findChoice(row.choices, row.value)?.label ?? row.value}
      items={row.choices}
      label={row.label}
      onSelect={row.select}
      {slideDuration}
      subtitle={row.subtitle}
    >
      {#snippet icon()}
        {@html row.icon}
      {/snippet}
    </SettingsDropDown>
  {/each}
</SettingsGroup>
