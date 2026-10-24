<script lang="ts">
  import settingsIcon from "../../icons/settings.svg?raw";
  import type { SettingsProps } from "../settings-props";
  import SettingsGroup from "../ui/SettingsGroup.svelte";
  import SettingsSwitchRow from "../ui/SettingsSwitchRow.svelte";
  import { MessageType, sendMessage } from "@/lib/messaging/messaging";
  import { setOption } from "@/lib/storage/storage";

  const { options }: SettingsProps = $props();

  const LOGS_FILENAME = "youtube-downloader-logs.txt";

  let status = $state("");
</script>

<SettingsGroup title="Troubleshooting">
  <SettingsSwitchRow
    icon={settingsIcon}
    isChecked={options.isLogsEnabled}
    label="Record logs to help find errors"
    onchange={isChecked => {
      void setOption({
        key: "isLogsEnabled",
        value: isChecked
      });
    }}
  />
  <div class="logs-actions">
    <button
      class="logs-button"
      onclick={async () => {
        const { report, entryCount } = await sendMessage(MessageType.GetLogs);
        if (!entryCount) {
          status = "Nothing recorded yet, turn it on and try a download";
          return;
        }

        const isCopied = await navigator.clipboard.writeText(report).then(() => true, () => false);
        status = isCopied ? `Copied ${entryCount} lines` : "Couldn't copy, save it as a file instead";
      }}
      type="button"
    >
      Copy logs
    </button>
    <button
      class="logs-button"
      onclick={async () => {
        const { report, entryCount } = await sendMessage(MessageType.GetLogs);
        if (!entryCount) {
          status = "Nothing recorded yet, turn it on and try a download";
          return;
        }

        const elLink = document.createElement("a");
        elLink.href = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
        elLink.download = LOGS_FILENAME;
        elLink.click();
        status = `Saved ${entryCount} lines`;
      }}
      type="button"
    >
      Save as file
    </button>
    <button
      class="logs-button"
      onclick={async () => {
        await sendMessage(MessageType.ClearLogs);
        status = "Logs cleared";
      }}
      type="button"
    >
      Clear
    </button>
  </div>
  <p class="logs-hint">{status || "Logs hide tokens and signed links, but they do include video titles"}</p>
</SettingsGroup>

<style>
  .logs-actions {
    display: flex;
    gap: 8px;
    padding-block: 4px 0;
    padding-inline: 14px;
  }

  .logs-button {
    flex: 1;
    padding-block: 8px;
    padding-inline: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: transparent;
    color: var(--accent);
    font-weight: 500;
    font-size: 0.75rem;
    cursor: pointer;

    &:hover {
      background: var(--accent-container);
    }
  }

  .logs-hint {
    margin: 0;
    padding-block: 8px 12px;
    padding-inline: 14px;
    color: var(--fg-muted);
    font-size: 0.71875rem;
  }
</style>
