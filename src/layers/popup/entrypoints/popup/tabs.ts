import downloadIcon from "./icons/download.svg?raw";
import settingsIcon from "./icons/settings.svg?raw";
import type { MessageKey } from "@/lib/i18n/es-419";
import { t } from "@/lib/i18n/i18n.svelte.ts";

export const PopupPanel = {
  Downloads: "downloads",
  Settings: "settings"
} as const;

export type PopupPanel = (typeof PopupPanel)[keyof typeof PopupPanel];

const PANEL_LABEL_KEYS = {
  [PopupPanel.Downloads]: "Downloads",
  [PopupPanel.Settings]: "Settings"
} as const satisfies Record<PopupPanel, MessageKey>;

export function getPanelLabel(panel: PopupPanel) {
  return t(PANEL_LABEL_KEYS[panel]);
}

export function buildTabs(totalActiveDownloads: number) {
  return [
    {
      id: PopupPanel.Downloads,
      label: getPanelLabel(PopupPanel.Downloads),
      badge: totalActiveDownloads,
      icon: downloadIcon
    },
    {
      id: PopupPanel.Settings,
      label: getPanelLabel(PopupPanel.Settings),
      icon: settingsIcon
    }
  ];
}
