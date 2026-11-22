import { readFileSync } from "node:fs";
import { buildManifestModelProviderConfig } from "openclaw/plugin-sdk/provider-catalog-shared";

export const PROVIDER_ID = "oathbreaker";

/** The plugin manifest is the single source of the model catalog. */
export const manifest = JSON.parse(
  readFileSync(new URL("./openclaw.plugin.json", import.meta.url), "utf8"),
);

export function buildOathbreakerProvider() {
  return buildManifestModelProviderConfig({
    providerId: PROVIDER_ID,
    catalog: manifest.modelCatalog.providers.oathbreaker,
  });
}

const DEFAULT_MODEL_ID = manifest.modelCatalog.providers.oathbreaker.defaultModel;
export const OATHBREAKER_DEFAULT_MODEL_REF = `${PROVIDER_ID}/${DEFAULT_MODEL_ID}`;
