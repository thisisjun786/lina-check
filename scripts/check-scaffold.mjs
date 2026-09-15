import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
assert.deepEqual(pkg, expectedPackage, "Package dependencies or script boundaries changed");
assert(
  !readdirSync(join(root, ".github/workflows")).some((name) => /\.ya?ml$/i.test(name)),
  "Active workflow found",
);

const additions = new Set([
  "POLICY.md",
  "config/lina-check-scaffold.json",
  "scripts/scaffold-disabled.mjs",
  "scripts/check-scaffold.mjs",
  ...docs.map((name) => `docs/upstream/${name}`),
  ...workflows.map((path) => `${path}.disabled`),
]);
const baseline = new Set(entries.map(({ path }) => path));
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
for (const path of git("ls-files", "-c", "-o", "--exclude-standard", "-z")
  .toString()
  .split("\0")
  .filter(Boolean)) {
  assert(baseline.has(path) || additions.has(path), `Unexpected source addition: ${path}`);
}
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
