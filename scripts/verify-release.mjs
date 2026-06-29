import fs from "node:fs";

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const tag = normalizeTag(process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "");

assert(packageJson.version === manifest.version, "package.json and manifest.json versions differ");
assert(
  versions[manifest.version] === manifest.minAppVersion,
  `versions.json must map ${manifest.version} to ${manifest.minAppVersion}`,
);
assert(fs.existsSync("main.js"), "main.js is missing; run npm run build first");
assert(fs.existsSync("manifest.json"), "manifest.json is missing");
assert(fs.existsSync("styles.css"), "styles.css is missing");

if (tag) {
  assert(
    tag === manifest.version,
    `release tag ${tag} must match manifest/package version ${manifest.version}`,
  );
}

console.log(`Release check passed for ${manifest.id} ${manifest.version}`);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function normalizeTag(value) {
  return value.replace(/^refs\/tags\//, "").replace(/^v(?=\d+\.\d+\.\d+)/, "");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
