import { t } from "@/lib/i18n/i18n.svelte.ts";
import {
  DownloadType,
  PlaylistDownloadMode,
  PlaylistOutputMode,
  type DownloadTypePreference,
  type Prettify
} from "@/types";

export type ToggleButtonState = Prettify<{
  downloadMode: PlaylistDownloadMode;
  outputMode: PlaylistOutputMode;
  effectiveDownloadType: DownloadTypePreference;
}>;

export type ToggleButtonGroup = Prettify<{
  id: string;
  label: string;
  tooltip: string;
  isActive(state: ToggleButtonState): boolean;
  onClick(state: ToggleButtonState): void;
}>;

export const TOGGLE_BUTTON_GROUPS = {
  speed: [
    {
      id: "playlist-mode-fast",
      get label() {
        return t("In parallel");
      },
      get tooltip() {
        return t("Download all in parallel");
      },
      isActive: state => state.downloadMode === PlaylistDownloadMode.Fast,
      onClick(state: ToggleButtonState) {
        state.downloadMode = PlaylistDownloadMode.Fast;
      }
    },
    {
      id: "playlist-mode-data-saver",
      get label() {
        return t("One at a time");
      },
      get tooltip() {
        return t("Download one at a time");
      },
      isActive: state => state.downloadMode === PlaylistDownloadMode.DataSaver,
      onClick(state: ToggleButtonState) {
        state.downloadMode = PlaylistDownloadMode.DataSaver;
      }
    }
  ],
  output: [
    {
      id: "playlist-output-individual",
      get label() {
        return t("Separate files");
      },
      get tooltip() {
        return t("Save as separate files");
      },
      isActive: state => state.outputMode === PlaylistOutputMode.Individual,
      onClick(state: ToggleButtonState) {
        state.outputMode = PlaylistOutputMode.Individual;
      }
    },
    {
      id: "playlist-output-zip",
      get label() {
        return t("Single ZIP");
      },
      get tooltip() {
        return t("Bundle into one ZIP");
      },
      isActive: state => state.outputMode === PlaylistOutputMode.Zip,
      onClick(state: ToggleButtonState) {
        state.outputMode = PlaylistOutputMode.Zip;
      }
    }
  ],
  type: [
    {
      id: "playlist-type-auto",
      get label() {
        return t("Auto");
      },
      get tooltip() {
        return t("Auto: audio for music, video+audio for rest");
      },
      isActive: state => state.effectiveDownloadType === DownloadType.Auto,
      onClick(state: ToggleButtonState) {
        state.effectiveDownloadType = DownloadType.Auto;
      }
    },
    {
      id: "playlist-type-video-audio",
      get label() {
        return t("Video + audio");
      },
      get tooltip() {
        return t("Video + audio stream");
      },
      isActive: state => state.effectiveDownloadType === DownloadType.VideoAndAudio,
      onClick(state: ToggleButtonState) {
        state.effectiveDownloadType = DownloadType.VideoAndAudio;
      }
    },
    {
      id: "playlist-type-video",
      get label() {
        return t("Video only");
      },
      get tooltip() {
        return t("Video stream only");
      },
      isActive: state => state.effectiveDownloadType === DownloadType.Video,
      onClick(state: ToggleButtonState) {
        state.effectiveDownloadType = DownloadType.Video;
      }
    },
    {
      id: "playlist-type-audio",
      get label() {
        return t("Audio only");
      },
      get tooltip() {
        return t("Audio stream only");
      },
      isActive: state => state.effectiveDownloadType === DownloadType.Audio,
      onClick(state: ToggleButtonState) {
        state.effectiveDownloadType = DownloadType.Audio;
      }
    }
  ]
} satisfies Record<string, ToggleButtonGroup[]>;

export const ALL_TOGGLE_BUTTONS = [
  ...TOGGLE_BUTTON_GROUPS.speed,
  ...TOGGLE_BUTTON_GROUPS.output,
  ...TOGGLE_BUTTON_GROUPS.type
];
