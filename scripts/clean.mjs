import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageDir = path.join(packagesDir, entry.name);
  const distDir = path.join(packageDir, "dist");
  const buildInfoPath = path.join(packageDir, ".tsbuildinfo");
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  if (existsSync(buildInfoPath)) {
    rmSync(buildInfoPath, { force: true });
  }
}
