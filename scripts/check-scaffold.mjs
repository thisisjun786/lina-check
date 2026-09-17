import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INSTALLATION_CONFIG_PATH,
  INSTALLATION_SCHEMA_PATH,
  MODIFIED_UPSTREAM_FILES,
  SAFE_TESTS,
  TRIPWIRE_ENV,
  WRANGLER_PATH,
  assertFixtureTestContract,
  assertModifiedUpstreamContract,
  assertNoForbiddenInstallationLiterals,
  assertShippedInstallationEmpty,
  assertWranglerUnconfigured,
  assertDerivedContract,
} from "./lina-check-derived-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pin = "1ed7bd4e13fb03334798e4d027ba3383ac9e5f01";
const tree = "1e3d7197e537f91f821a5d6780a527e6d2a1975d";
const git = (...args) =>
  execFileSync("git", ["-C", root, ...args], { maxBuffer: 64 * 1024 * 1024 });
const read = (path) => readFileSync(join(root, path));
const json = (path) => JSON.parse(read(path));
const config = json("config/lina-check-scaffold.json");
const upstream = JSON.parse(git("show", `${pin}:package.json`));
const pkg = json("package.json");
const allowed = [
  "build",
  "build:repair",
  "build:dashboard",
  "build:node",
  "build:all",
  "lint",
  "lint:src",
  "lint:repair",
  "lint:scripts",
  "lint:dashboard",
];
const docs = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "VISION.md"];
const guard = (name) => `node scripts/scaffold-disabled.mjs ${name}`;
const entries = git("ls-tree", "-rz", pin)
  .toString()
  .split("\0")
  .filter(Boolean)
  .map((line) => {
    const match = /^(\d+) blob ([0-9a-f]+)\t([\s\S]+)$/.exec(line);
    assert(match, `Unsupported upstream tree entry: ${line}`);
    return { mode: match[1], hash: match[2], path: match[3] };
  });
const workflows = entries
  .filter(({ path }) => path.startsWith(".github/workflows/") && /\.ya?ml$/i.test(path))
  .map(({ path }) => path);
assert.equal(workflows.length, 35);
assert.equal(git("rev-parse", `${pin}^{tree}`).toString().trim(), tree);
assert.equal(
  git("rev-parse", "--is-shallow-repository").toString().trim(),
  "false",
  "A full clone is required to verify upstream ancestry",
);
git("merge-base", "--is-ancestor", pin, "HEAD");
assert.equal(config.stage, "dormant-scaffold");
assert.deepEqual(config.upstream, {
  repository: "https://github.com/openclaw/clawsweeper",
  commit: pin,
  tree,
  license: "MIT",
  shallow: false,
  graftCommit: null,
});
assert.equal(config.automationEnabled, false);
assert.equal(config.integrationsImplemented, false);
assert.deepEqual(config.codeReviewProviders, ["Devin", "Codex"]);
assert.deepEqual(config.oracle, {
  enabled: false,
  intendedCaller: "installation-authorized-user",
  implemented: false,
});
assert.deepEqual(
  config.allowedScripts,
  Object.fromEntries(allowed.map((name) => [name, upstream.scripts[name]])),
);
const blocked = Object.fromEntries(
  Object.entries(upstream.scripts).filter(([name]) => !allowed.includes(name)),
);
assert.deepEqual(config.blockedScripts, blocked);
assert.deepEqual(
  config.parkedWorkflows,
  Object.fromEntries(workflows.map((path) => [path, `${path}.disabled`])),
);
const expectedPackage = structuredClone(upstream);
expectedPackage.name = "@lina-check/clawsweeper";
expectedPackage.scripts = Object.fromEntries(
  Object.entries(upstream.scripts).map(([name, command]) => [
    name,
    allowed.includes(name) ? command : guard(name),
  ]),
);
expectedPackage.scripts["check:scaffold"] = "node scripts/check-scaffold.mjs";
for (const [name, entry] of Object.entries(config.derived.scripts))
  expectedPackage.scripts[name] = entry.command;
assert.deepEqual(pkg, expectedPackage, "Package dependencies or script boundaries changed");
assert(
  !readdirSync(join(root, ".github/workflows")).some((name) => /\.ya?ml$/i.test(name)),
  "Active workflow found",
);

const coreAdditions = new Set([
  "POLICY.md",
  "config/lina-check-scaffold.json",
  "scripts/scaffold-disabled.mjs",
  "scripts/check-scaffold.mjs",
  ...docs.map((name) => `docs/upstream/${name}`),
  ...workflows.map((path) => `${path}.disabled`),
]);
const additions = new Set([...coreAdditions, ...Object.keys(config.derived.files)]);
const baseline = new Set(entries.map(({ path }) => path));
// Upstream files this fork is allowed to change. The set is a code literal in
// the contract module; configuration supplies only the reason for each entry.
const modifiedUpstream = new Set(MODIFIED_UPSTREAM_FILES);
const observedUpstreamChange = new Set();
for (const entry of entries) {
  if (["package.json", ".gitignore"].includes(entry.path)) continue;
  const path = docs.includes(entry.path)
    ? `docs/upstream/${entry.path}`
    : workflows.includes(entry.path)
      ? `${entry.path}.disabled`
      : entry.path;
  const file = join(root, path);
  const stat = lstatSync(file);
  const data = stat.isSymbolicLink() ? Buffer.from(readlinkSync(file)) : readFileSync(file);
  const hash = createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
  // A declared file must actually differ. A declaration left behind after the
  // edit was reverted would otherwise keep the exception open forever.
  if (modifiedUpstream.has(path)) {
    assert.notEqual(hash, entry.hash, `Declared modified upstream file is unchanged: ${path}`);
    // The mode check is repeated rather than shared so the two original
    // assertions below stay byte-identical. The self-test refuses any diff that
    // deletes an assertion line, and rewriting them to share a branch would
    // read as a deletion even though nothing was given up.
    assert.equal(
      stat.isSymbolicLink() ? "120000" : stat.mode & 0o111 ? "100755" : "100644",
      entry.mode,
      `Upstream mode changed: ${path}`,
    );
    observedUpstreamChange.add(path);
    continue;
  }
  assert.equal(hash, entry.hash, `Upstream bytes changed: ${path}`);
  const mode = stat.isSymbolicLink() ? "120000" : stat.mode & 0o111 ? "100755" : "100644";
  assert.equal(mode, entry.mode, `Upstream mode changed: ${path}`);
  if (workflows.includes(entry.path))
    assert(!existsSync(join(root, entry.path)), `Workflow still active: ${entry.path}`);
}
const ignoreAppend =
  "\n# Local LINA Check tooling and private runtime data\n.codexclaw/\n.omo/\n.lina-check-state/\n.env.*\n!.env.example\n!.env.*.example\n*.sqlite\n*.sqlite-*\n";
assert.equal(
  read(".gitignore").toString(),
  git("show", `${pin}:.gitignore`).toString() + ignoreAppend,
);
for (const path of additions)
  assert(existsSync(join(root, path)), `Missing scaffold file: ${path}`);
const present = git("ls-files", "-c", "-o", "--exclude-standard", "-z")
  .toString()
  .split("\0")
  .filter(Boolean);
for (const path of present)
  assert(baseline.has(path) || additions.has(path), `Unexpected source addition: ${path}`);

// Derived-change declaration. The permitted sets are literals owned by the
// contract module; the configuration only records why each entry is allowed.
const derivedSummary = assertDerivedContract({
  config,
  upstreamScripts: upstream.scripts,
  packageScripts: pkg.scripts,
  baselinePaths: baseline,
  presentPaths: new Set(present),
  coreAdditions,
  docs,
  readFile: (path) => read(path).toString(),
  isRegularFile: (path) => lstatSync(join(root, path)).isFile(),
});

// The installation entry point ships empty. This is not the same question as
// whether the loader rejects an empty profile at runtime: it keeps a populated
// installation from reaching main, which would hand every clone somebody else's
// targets. The runtime denial paths are covered by lina:contract-selftest.
const installationSummary = assertShippedInstallationEmpty(json(INSTALLATION_CONFIG_PATH));
assert(
  existsSync(join(root, INSTALLATION_SCHEMA_PATH)),
  "Missing installation schema: " + INSTALLATION_SCHEMA_PATH,
);

const modifiedSummary = assertModifiedUpstreamContract({
  declared: config.derived.modifiedUpstreamFiles,
  baselinePaths: baseline,
  presentPaths: new Set(present),
  changed: (path) => observedUpstreamChange.has(path),
  isRegularFile: (path) => lstatSync(join(root, path)).isFile(),
});

// Ordinary repository names are not forbidden literals, so a target list that
// still points somewhere would pass the scan below. These keys are checked by
// name instead. This matters because the restored profile test now reads pinned
// upstream bytes and no longer looks at the real file.
const wranglerSummary = assertWranglerUnconfigured(read(WRANGLER_PATH).toString());

// A test that runs against pinned bytes proves something different from one that
// runs against this fork. The mapping that decides which is which is checked here.
const fixtureSummary = assertFixtureTestContract(config.derived.upstreamFixtureTests, baseline);

// Values this fork removed must not reappear in the files it owns. Scoped to
// behaviour-carrying paths; the reasoning is in the contract module.
assertNoForbiddenInstallationLiterals(
  [...Object.keys(config.derived.files), ...MODIFIED_UPSTREAM_FILES],
  (path) => read(path).toString(),
);

// Observe the preview at the test-launch boundary rather than trusting its own
// report: the tripwire makes any spawn from the runner fail loudly, so a
// successful preview means the boundary was never reached.
const preview = spawnSync(
  process.execPath,
  [join(root, "scripts/lina-check-safe-tests.mjs"), "preview", "--json"],
  {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, [TRIPWIRE_ENV]: "1" },
  },
);
assert.equal(preview.status, 0, "Safe-test preview failed under the spawn tripwire");
const previewReport = JSON.parse(preview.stdout);
assert.equal(previewReport.executed, false, "Safe-test preview claimed execution");
assert.deepEqual(
  previewReport.files,
  [...SAFE_TESTS],
  "Safe-test preview targets differ from the restored-test literal",
);
for (const name of Object.keys(blocked)) {
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/scaffold-disabled.mjs"), name, "--enable"],
    { cwd: root, encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.status, 1, `Guard failed for ${name}`);
  assert(result.stderr.includes("is disabled"), `Missing disabled diagnostic for ${name}`);
}
console.log(
  `PASS: upstream ${pin}; ${entries.length} original entries checked; ${workflows.length} workflows parked; ${Object.keys(blocked).length} commands blocked; source/license/dependency provenance intact.`,
);
console.log(
  "Dormant scaffold only; live integrations, upstream full tests and direct-source isolation are not verified.",
);
console.log(
  `Derived declarations validated: ${derivedSummary.files} files; ${derivedSummary.scripts} scripts; ${derivedSummary.safeTests} restored upstream tests; ${derivedSummary.probes} boundary-probe targets; preview observed non-executing under ${TRIPWIRE_ENV}.`,
);
console.log(
  `Installation entry point ships unconfigured: ${installationSummary.sections} sections; ${installationSummary.emptyStrings} empty settings; no forbidden upstream literal in fork-owned code or configuration.`,
);
console.log(
  `Declared upstream modifications: ${modifiedSummary.files} files, each observed to differ from the pin; Worker settings emptied: ${wranglerSummary.emptied} variables, ${wranglerSummary.removed} upstream-owned keys absent.`,
);
console.log(
  `${fixtureSummary.tests} restored test(s) run against pinned upstream bytes rather than this installation; the fork's own settings are asserted here, not there.`,
);
