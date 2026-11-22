import { readConfiguredProviderCatalogEntries } from "openclaw/plugin-sdk/provider-catalog-shared";
import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { createProviderConnectionPresetAppliers } from "openclaw/plugin-sdk/provider-onboard";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import {
  OATHBREAKER_DEFAULT_MODEL_REF,
  PROVIDER_ID,
  buildOathbreakerProvider,
  manifest,
} from "./models.js";

const oathbreakerProvider = buildOathbreakerProvider();

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "Oathbreaker Provider",
  description: "Oathbreaker provider plugin",
  manifest,
  provider: {
    label: "Oathbreaker",
    docsPath: "https://oathbreaker.ai/docs",
    envVars: ["OATHBREAKER_API_KEY"],
    manifestAuth: {
      defaultModel: OATHBREAKER_DEFAULT_MODEL_REF,
      applyConfig: createProviderConnectionPresetAppliers({
        primaryModelRef: OATHBREAKER_DEFAULT_MODEL_REF,
        resolveParams: () => ({
          providerId: PROVIDER_ID,
          api: "openai-completions",
          baseUrl: oathbreakerProvider.baseUrl,
          catalogModels: () => oathbreakerProvider.models,
          aliases: [{ modelRef: OATHBREAKER_DEFAULT_MODEL_REF, alias: "GLM-5.3 Abliterated" }],
        }),
      }).applyConfig,
      noteTitle: "Oathbreaker",
      noteMessage: "Create an API key and add prepaid credit at https://oathbreaker.ai.",
    },
    catalog: {},
    augmentModelCatalog: ({ config }) =>
      readConfiguredProviderCatalogEntries({ config, providerId: PROVIDER_ID }),
    // Oathbreaker returns reasoning_content and expects it back on assistant
    // tool-call turns, so keep reasoning in the replayed history.
    ...buildProviderReplayFamilyHooks({
      family: "openai-compatible",
      dropReasoningFromHistory: false,
    }),
    ...buildProviderToolCompatFamilyHooks("openai"),
    isModernModelRef: () => true,
  },
});
