/**
 * Definition: Node-side loader for the installation profile.
 *
 * Kept apart from lina-check-installation-contract.ts on purpose. That module is
 * imported by the Cloudflare Worker graph and must stay free of node:fs; this one
 * reads the file and must never be pulled into that graph.
 *
 * A missing or unreadable file is not an error here. It resolves to the
 * unconfigured profile, which denies everything. Throwing instead would let a
 * caller's catch block turn a configuration fault into an admission.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  UNCONFIGURED_INSTALLATION,
  parseInstallationProfile,
  type InstallationDenialCode,
  type InstallationProfile,
} from "./lina-check-installation-contract.js";

export const INSTALLATION_CONFIG_PATH = "config/lina-check-installation.json";

function repoRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export type InstallationLoad = {
  profile: InstallationProfile;
  denied: { code: InstallationDenialCode | "installation-unreadable"; detail: string } | null;
};

/** Resolve the installation profile, reporting why it denies when it does. */
export function loadInstallationProfile(
  filePath = join(repoRoot(), INSTALLATION_CONFIG_PATH),
): InstallationLoad {
  if (!existsSync(filePath))
    return {
      profile: UNCONFIGURED_INSTALLATION,
      denied: { code: "installation-unreadable", detail: "no installation profile at " + filePath },
    };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      profile: UNCONFIGURED_INSTALLATION,
      denied: {
        code: "installation-unreadable",
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  const parsed = parseInstallationProfile(raw);
  return parsed.ok
    ? { profile: parsed.profile, denied: null }
    : { profile: UNCONFIGURED_INSTALLATION, denied: { code: parsed.code, detail: parsed.detail } };
}

let cached: InstallationLoad | null = null;

/** Cached accessor for call sites that resolve the profile on every admission check. */
export function installationProfile(): InstallationProfile {
  if (!cached) cached = loadInstallationProfile();
  return cached.profile;
}

/** Test seam: drop the cache so a fixture path can be loaded in the same process. */
export function resetInstallationProfileCache(): void {
  cached = null;
}
