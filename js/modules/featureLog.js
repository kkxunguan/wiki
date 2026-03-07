// Feature changelog registry.
// When adding a new feature, append one new entry with a bumped version.
export const FEATURE_LOG = [
  {
    version: "v1.0.0",
    date: "2026-03-07",
    summary: "Internationalization extraction and language-file architecture."
  },
  {
    version: "v1.1.0",
    date: "2026-03-07",
    summary: "Language switcher with persistence and runtime UI refresh."
  },
  {
    version: "v1.2.0",
    date: "2026-03-07",
    summary: "Feature changelog file and latest-version display in Wiki UI."
  }
];

function parseVersion(rawVersion) {
  const clean = String(rawVersion || "")
    .trim()
    .replace(/^v/i, "");
  const parts = clean.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return [0, 0, 0];
  }
  return parts;
}

function compareVersionDesc(a, b) {
  const av = parseVersion(a && a.version);
  const bv = parseVersion(b && b.version);
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return bv[i] - av[i];
  }
  return 0;
}

export function getLatestFeatureEntry() {
  if (!Array.isArray(FEATURE_LOG) || !FEATURE_LOG.length) return null;
  const sorted = [...FEATURE_LOG].sort(compareVersionDesc);
  return sorted[0] || null;
}

export function getLatestVersion() {
  const latest = getLatestFeatureEntry();
  return latest && latest.version ? latest.version : "v0.0.0";
}

