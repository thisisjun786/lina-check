/**
 * Definition: the LINA Check installation profile contract.
 *
 * Upstream decided admission in two places: a hardcoded owner set in source and
 * a repository list fetched from a remote registry. Neither belongs to the
 * installation running this fork. This module inverts that. The registry may
 * still supply profiles, but only the installation profile grants permission.
 *
 * An empty profile is not a permissive default. Every admission helper here
 * denies when the installation is unconfigured, so a fork that ships without
 * configuration admits nothing.
 *
 * Purity matters: this module is imported by the Cloudflare Worker graph, which
 * has no Node filesystem. It must never import node:fs. The loader that reads
 * the file lives in lina-check-installation.ts and stays out of that graph.
 */

export const LINA_CHECK_INSTALLATION_SCHEMA_VERSION = 1;

/** Every way a profile can fail to grant. Stable strings so the self-test can match them. */
export type InstallationDenialCode =
  | "installation-unconfigured"
  | "installation-shape"
  | "installation-schema"
  | "installation-empty"
  | "installation-owner-shape"
  | "installation-owner-duplicate"
  | "installation-repository-shape"
  | "installation-repository-duplicate"
  | "installation-field-shape"
  | "installation-registry-shape";

export type InstallationBranding = {
  productName: string;
  shortName: string;
  userAgent: string;
  dashboardHost: string;
};

export type InstallationProfile = {
  schemaVersion: typeof LINA_CHECK_INSTALLATION_SCHEMA_VERSION;
  configured: boolean;
  branding: InstallationBranding;
  fallbackOwners: readonly string[];
  repositories: readonly string[];
  registryUrl: string;
  stateRepo: string;
  stateRef: string;
  appClientId: string;
  appBotLogin: string;
};

/**
 * Deliberately not a discriminated union. This module is compiled by the
 * dashboard project too, which runs with strict off, and narrowing on a literal
 * discriminant needs strictNullChecks. A flat shape that always carries a
 * profile also removes the failure mode where a caller reads a profile that is
 * not there: on refusal the profile is the unconfigured one, which grants nothing.
 */
export type InstallationParse = {
  ok: boolean;
  profile: InstallationProfile;
  code: InstallationDenialCode | null;
  detail: string;
};

const OWNER = /^[a-z0-9_.-]+$/;
const TARGET_REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;

/**
 * Neutral fallback branding. Deliberately not the upstream product name: an
 * unconfigured fork should not present itself as the project it forked.
 */
const NEUTRAL_BRANDING: InstallationBranding = Object.freeze({
  productName: "LINA Check",
  shortName: "lina-check",
  userAgent: "lina-check",
  dashboardHost: "",
});

/** The profile every deny path falls back to. Nothing is admitted through it. */
export const UNCONFIGURED_INSTALLATION: InstallationProfile = Object.freeze({
  schemaVersion: LINA_CHECK_INSTALLATION_SCHEMA_VERSION,
  configured: false,
  branding: NEUTRAL_BRANDING,
  fallbackOwners: Object.freeze([]) as readonly string[],
  repositories: Object.freeze([]) as readonly string[],
  registryUrl: "",
  stateRepo: "",
  stateRef: "",
  appClientId: "",
  appBotLogin: "",
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function deny(code: InstallationDenialCode, detail: string): InstallationParse {
  return { ok: false, profile: UNCONFIGURED_INSTALLATION, code, detail };
}

/**
 * The published schema requires every branding, state and App field to exist and
 * be a string. Coercing a missing or numeric field to "" here would accept a
 * document the schema rejects, and an operator would get a profile that looks
 * configured while carrying defaults they never wrote.
 */
function missingStringField(
  section: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): string | null {
  for (const key of keys) if (typeof section[key] !== "string") return label + "." + key;
  return null;
}

function readList(
  raw: unknown,
  pattern: RegExp,
  shapeCode: InstallationDenialCode,
  duplicateCode: InstallationDenialCode,
  label: string,
): { list: string[]; code: InstallationDenialCode | null; detail: string } {
  const refuse = (code: InstallationDenialCode, detail: string) => ({ list: [], code, detail });
  if (!Array.isArray(raw)) return refuse(shapeCode, label + " must be an array");
  const list: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") return refuse(shapeCode, label + " entry is not a string");
    const normalized = entry.trim().toLowerCase();
    if (!pattern.test(normalized)) return refuse(shapeCode, label + " entry is malformed: " + entry);
    if (list.includes(normalized)) return refuse(duplicateCode, label + " repeats " + normalized);
    list.push(normalized);
  }
  return { list, code: null, detail: "" };
}

/**
 * Parse a declaration into a profile, or say exactly why it grants nothing.
 *
 * A configured profile with no owners and no repositories is rejected rather
 * than accepted as an empty allowlist. Silently accepting it would let a
 * half-finished configuration look like a working one.
 */
export function parseInstallationProfile(value: unknown): InstallationParse {
  const root = asRecord(value);
  if (!root) return deny("installation-shape", "installation profile must be an object");
  if (root.schema_version !== LINA_CHECK_INSTALLATION_SCHEMA_VERSION)
    return deny("installation-schema", "unsupported schema_version: " + String(root.schema_version));
  if (typeof root.configured !== "boolean")
    return deny("installation-shape", "configured must be a boolean");

  const brandingRecord = asRecord(root.branding);
  const targetsRecord = asRecord(root.targets);
  const stateRecord = asRecord(root.state);
  const appRecord = asRecord(root.github_app);
  if (!brandingRecord || !targetsRecord || !stateRecord || !appRecord)
    return deny("installation-shape", "branding, targets, state and github_app must all be objects");

  const missing =
    missingStringField(
      brandingRecord,
      ["product_name", "short_name", "user_agent", "dashboard_host"],
      "branding",
    ) ??
    missingStringField(targetsRecord, ["registry_url"], "targets") ??
    missingStringField(stateRecord, ["state_repo", "state_ref"], "state") ??
    missingStringField(appRecord, ["client_id", "bot_login"], "github_app");
  if (missing !== null)
    return deny("installation-field-shape", missing + " must be present and a string");

  const owners = readList(
    targetsRecord.fallback_owners,
    OWNER,
    "installation-owner-shape",
    "installation-owner-duplicate",
    "targets.fallback_owners",
  );
  if (owners.code !== null) return deny(owners.code, owners.detail);
  const repositories = readList(
    targetsRecord.repositories,
    TARGET_REPO,
    "installation-repository-shape",
    "installation-repository-duplicate",
    "targets.repositories",
  );
  if (repositories.code !== null) return deny(repositories.code, repositories.detail);

  const registryUrl = asString(targetsRecord.registry_url);
  if (registryUrl !== "" && !registryUrl.startsWith("https://"))
    return deny("installation-registry-shape", "targets.registry_url must be https or empty");

  if (root.configured && owners.list.length === 0 && repositories.list.length === 0)
    return deny("installation-empty", "a configured installation must name at least one owner or repository");

  const branding: InstallationBranding = {
    productName: asString(brandingRecord.product_name) || NEUTRAL_BRANDING.productName,
    shortName: asString(brandingRecord.short_name) || NEUTRAL_BRANDING.shortName,
    userAgent: asString(brandingRecord.user_agent) || NEUTRAL_BRANDING.userAgent,
    dashboardHost: asString(brandingRecord.dashboard_host),
  };

  return {
    ok: true,
    code: null,
    detail: "",
    profile: {
      schemaVersion: LINA_CHECK_INSTALLATION_SCHEMA_VERSION,
      configured: root.configured,
      branding,
      fallbackOwners: owners.list,
      repositories: repositories.list,
      registryUrl,
      stateRepo: asString(stateRecord.state_repo).toLowerCase(),
      stateRef: asString(stateRecord.state_ref),
      appClientId: asString(appRecord.client_id),
      appBotLogin: asString(appRecord.bot_login).toLowerCase(),
    },
  };
}

/** A parse failure is a denial, not an exception: callers must not treat it as a pass. */
export function profileOrUnconfigured(value: unknown): InstallationProfile {
  return parseInstallationProfile(value).profile;
}

export function installationConfigured(profile: InstallationProfile | null | undefined): boolean {
  if (!profile || !profile.configured) return false;
  return profile.fallbackOwners.length > 0 || profile.repositories.length > 0;
}

function normalizeTargetRepo(targetRepo: string): string | null {
  const normalized = String(targetRepo || "").trim().toLowerCase();
  return TARGET_REPO.test(normalized) ? normalized : null;
}

/** Explicitly admitted by the installation, independent of any registry content. */
export function installationAdmitsRepository(
  profile: InstallationProfile | null | undefined,
  targetRepo: string,
): boolean {
  if (!installationConfigured(profile) || !profile) return false;
  const normalized = normalizeTargetRepo(targetRepo);
  return normalized !== null && profile.repositories.includes(normalized);
}

/**
 * Whether a generic registry fallback for this owner may be consulted at all.
 * The registry cannot add owners; it can only describe the ones named here.
 */
export function installationAdmitsFallbackOwner(
  profile: InstallationProfile | null | undefined,
  owner: string,
): boolean {
  if (!installationConfigured(profile) || !profile) return false;
  const normalized = String(owner || "").trim().toLowerCase();
  return OWNER.test(normalized) && profile.fallbackOwners.includes(normalized);
}

/** Null means no registry request is made at all, rather than a request to a default host. */
export function installationRegistryUrl(
  profile: InstallationProfile | null | undefined,
): string | null {
  if (!installationConfigured(profile) || !profile) return null;
  return profile.registryUrl === "" ? null : profile.registryUrl;
}

export function resolveBranding(
  profile: InstallationProfile | null | undefined,
): InstallationBranding {
  return profile ? profile.branding : NEUTRAL_BRANDING;
}

/** User-Agent for outbound requests, so the fork does not announce the upstream product. */
export function hasGithubCredential(env: Record<string, unknown>): boolean {
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  return (
    text(env.GITHUB_TOKEN) !== "" ||
    text(env.CLAWSWEEPER_TOKEN) !== "" ||
    text(env.CLAWSWEEPER_APP_PRIVATE_KEY) !== ""
  );
}

/**
 * Whether a GitHub request may be built at all.
 *
 * Emptying configuration does not stop a request; it only makes the request
 * useless. An installation with neither configuration nor any credential has
 * nothing to ask and no way to authenticate, so the request is refused before
 * it is constructed rather than sent and failed.
 *
 * This is narrower than refusing on configuration alone, and the narrower claim
 * is the one recorded in the plan. A deployment carrying credentials can still
 * reach GitHub; what it cannot do is act on a target, because admission is
 * gated separately and denies without an installation profile.
 */
export function githubTransportAllowed(env: Record<string, unknown>): boolean {
  return installationConfigured(installationFromEnv(env)) || hasGithubCredential(env);
}

export function brandedUserAgent(
  profile: InstallationProfile | null | undefined,
  suffix: string,
): string {
  const base = resolveBranding(profile).userAgent || NEUTRAL_BRANDING.userAgent;
  const tail = String(suffix || "").trim();
  return tail === "" ? base : base + "-" + tail;
}

/**
 * Worker side. Cloudflare passes configuration as strings, so the profile is
 * rebuilt from LINA_CHECK_* variables. Absent or blank variables produce the
 * unconfigured profile, which denies.
 */
export function installationFromEnv(env: Record<string, unknown>): InstallationProfile {
  // Worker configuration arrives as unknown. Coerce narrowly rather than with
  // String(), which would turn an object into "[object Object]" and let a
  // malformed variable read as a present setting.
  const envString = (value: unknown): string => (typeof value === "string" ? value : "");
  const list = (raw: unknown): string[] =>
    envString(raw)
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== "");
  return parseInstallationProfile({
    schema_version: LINA_CHECK_INSTALLATION_SCHEMA_VERSION,
    configured: envString(env.LINA_CHECK_INSTALLATION_CONFIGURED) === "1",
    branding: {
      product_name: envString(env.LINA_CHECK_PRODUCT_NAME),
      short_name: envString(env.LINA_CHECK_SHORT_NAME),
      user_agent: envString(env.LINA_CHECK_USER_AGENT),
      dashboard_host: envString(env.LINA_CHECK_DASHBOARD_HOST),
    },
    targets: {
      fallback_owners: list(env.LINA_CHECK_TARGET_OWNERS),
      repositories: list(env.LINA_CHECK_TARGET_REPOS),
      registry_url: envString(env.LINA_CHECK_TARGET_REGISTRY_URL),
    },
    state: {
      state_repo: envString(env.EXACT_REVIEW_STATE_REPO),
      state_ref: envString(env.EXACT_REVIEW_STATE_REF),
    },
    github_app: {
      client_id: envString(env.CLAWSWEEPER_APP_CLIENT_ID),
      bot_login: envString(env.LINA_CHECK_BOT_LOGIN),
    },
  }).profile;
}
