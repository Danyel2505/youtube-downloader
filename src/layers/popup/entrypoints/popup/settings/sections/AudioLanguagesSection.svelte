<script lang="ts">
  import type { SettingsProps } from "../settings-props";
  import { t } from "@/lib/i18n/i18n.svelte.ts";
  import { setOption } from "@/lib/storage/storage";
  import { normalizeLanguageCode } from "@/lib/youtube/audio-format-helpers";
  import { getLanguageName, LANGUAGES } from "#popup/lib/languages";

  const { options }: SettingsProps = $props();

  const PARENTHESIS_SUFFIX = / \(.*\)$/;
  const languageChoices = $derived([...new Map(LANGUAGES.map(([name, code]) => [
    normalizeLanguageCode(code),
    getLanguageName({
      name,
      code
    }).replace(PARENTHESIS_SUFFIX, "")
  ])).entries()]);
</script>

<fieldset class="set-section-fieldset">
  <legend class="languages-legend">{t("Audio languages to download by default")}</legend>
  <p class="languages-hint">
    {options.audioLanguages.length ? t("Other tracks are skipped") : t("None marked, so every track is downloaded")}
  </p>
  <div class="languages-grid">
    {#each languageChoices as [code, name] (code)}
      <label class="language-chip">
        <input
          class="language-input"
          checked={options.audioLanguages.includes(code)}
          onchange={e => {
            const others = options.audioLanguages.filter(language => language !== code);
            void setOption({
              key: "audioLanguages",
              value: e.currentTarget.checked ? [...others, code] : others
            });
          }}
          type="checkbox"
        />
        <span class="language-name">{name}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .set-section-fieldset {
    margin: 0;
    padding: 0;
    border: none;
    border-top: 1px solid var(--border);
  }

  .languages-legend {
    padding-block: 10px 2px;
    padding-inline: 14px;
    color: var(--fg-muted);
    font-weight: 500;
    font-size: 0.75rem;
  }

  .languages-hint {
    margin: 0;
    padding-inline: 14px;
    color: var(--fg-muted);
    font-size: 0.71875rem;
  }

  .languages-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-block: 10px 14px;
    padding-inline: 14px;
  }

  .language-chip {
    position: relative;
    cursor: pointer;
  }

  .language-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0%;
  }

  .language-name {
    display: block;
    padding: 5px 11px;
    border-radius: 999px;
    color: var(--fg);
    font-size: 0.78125rem;
    box-shadow: inset 0 0 0 1.5px var(--fg-subtle);
    transition: background-color 150ms, box-shadow 150ms;

    .language-chip:hover & {
      background-color: var(--surface-high);
    }

    .language-input:checked + & {
      background-color: var(--accent);
      color: var(--on-primary);
      box-shadow: inset 0 0 0 1.5px var(--accent);
    }

    .language-chip:has(.language-input:focus-visible) & {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }
</style>
