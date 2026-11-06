import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const forbidden = [
  [/\b(?:ubuntu|windows|macos)-[\w.-]+\b/i, "runner hospedado"],
  [
    /uses:\s*actions\/(?:cache|upload-artifact)@/i,
    "cache o artefacto de GitHub",
  ],
  [/type=gha\b/i, "cache type=gha"],
];

function violations(source) {
  const runners = source
    .split("\n")
    .filter((line) => line.trimStart().startsWith("runs-on:"))
    .map((line) => line.trim().replace(/\s+#.*$/, ""));
  const reusableWorkflows = source
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.startsWith("uses:") && line.includes("/.github/workflows/")
    )
    .filter(
      (line) =>
        !line.includes(
          "fondomp-production/platform-workflows/.github/workflows/runner-policy.yml@921e9463b09d904678e5e07e18bb5cf2df0e92cf"
        )
    );
  return [
    ...runners
      .filter((line) => line !== "runs-on: idp-arc-default")
      .map(() => "runner distinto de idp-arc-default"),
    ...reusableWorkflows.map(() => "workflow reusable no aprobado"),
    ...forbidden.flatMap(([pattern, reason]) =>
      pattern.test(source) ? [reason] : []
    ),
  ];
}

function audit(file) {
  const found = violations(readFileSync(file, "utf8"));
  if (found.length) throw new Error(`${file}: ${found.join(", ")}`);
}

if (process.argv.includes("--self-test")) {
  const directory = mkdtempSync(join(tmpdir(), "v7-backstage-audit-"));
  const fixture = join(directory, "hosted-runner.yml");
  writeFileSync(fixture, "jobs:\n  unsafe:\n    runs-on: ubuntu-26.04\n");
  try {
    audit(fixture);
    throw new Error("el control positivo no detectó el runner hospedado");
  } catch (error) {
    if (!String(error.message).includes("runner hospedado")) throw error;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("control positivo: runner hospedado detectado");
}

for (const file of process.argv.slice(2).filter((arg) => arg.endsWith(".yml")))
  audit(file);
console.log("auditor: sin runners o almacenamiento de GitHub prohibidos");
