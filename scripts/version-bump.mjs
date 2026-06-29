import fs from "node:fs";

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

const version = packageJson.version;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json version is not semver-like: ${version}`);
}

manifest.version = version;
versions[version] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("versions.json", sortVersionMap(versions));

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sortVersionMap(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareSemver(left, right)),
  );
}

function compareSemver(left, right) {
  const a = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const b = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta;
  }
  return left.localeCompare(right);
}
