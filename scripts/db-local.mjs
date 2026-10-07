#!/usr/bin/env node
// Local Supabase for development (needs Docker Desktop running).
//
//   npm run db:start   start Supabase, load supabase/schema.sql, write .env.local
//   npm run db:reset   wipe local data and re-apply supabase/schema.sql
//   npm run db:stop    stop the containers (data is kept)
//
// supabase/schema.sql stays the single source of truth; it is copied into the
// CLI's migrations folder (git-ignored) right before start/reset.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = "npx -y supabase@2";
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
const capture = (cmd) => execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

function syncMigration() {
  const dir = path.join(root, "supabase", "migrations");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(root, "supabase", "schema.sql"), path.join(dir, "00000000000000_schema.sql"));
}

function checkDocker() {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    console.error("\nDocker is not running. Install/start Docker Desktop (https://www.docker.com/products/docker-desktop/) and try again.\n");
    process.exit(1);
  }
}

/** Merge the local Supabase URL and keys into .env.local, keeping everything else. */
function writeEnv() {
  const status = Object.fromEntries(
    capture(`${cli} status -o env`)
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  const wanted = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
  if (!wanted.NEXT_PUBLIC_SUPABASE_URL || !wanted.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Could not read keys from `supabase status`; copy them into .env.local by hand.");
    return;
  }

  const envPath = path.join(root, ".env.local");
  const source = fs.existsSync(envPath) ? envPath : path.join(root, ".env.example");
  let lines = fs.readFileSync(source, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(wanted)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  if (!lines.some((l) => /^OCR_PROVIDER=\S/.test(l))) {
    lines = lines.map((l) => (l.startsWith("OCR_PROVIDER=") ? "OCR_PROVIDER=mock" : l));
  }
  fs.writeFileSync(envPath, lines.join("\n"));
  console.log("\n.env.local updated with your local Supabase URL and keys.");
  console.log(`Login emails arrive in Mailpit: ${status.MAILPIT_URL ?? status.INBUCKET_URL ?? "http://127.0.0.1:54324"}`);
  console.log("Next: npm run dev  ->  http://localhost:3000\n");
}

const cmd = process.argv[2];
if (cmd === "start") {
  checkDocker();
  syncMigration();
  run(`${cli} start`);
  writeEnv();
} else if (cmd === "reset") {
  checkDocker();
  syncMigration();
  run(`${cli} db reset`);
} else if (cmd === "stop") {
  run(`${cli} stop`);
} else {
  console.log("usage: node scripts/db-local.mjs start|reset|stop");
  process.exit(1);
}
