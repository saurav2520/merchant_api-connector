import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const testSuites = [
  "unit/url-validation.test.mjs",
  "unit/normalizers.test.mjs",
  "unit/rate-limiter.test.mjs",
  "unit/circuit-breaker.test.mjs",
  "unit/retry.test.mjs",
  "unit/auth.test.mjs",
  "unit/redaction.test.mjs",
  "integration/tools.test.mjs",
  "security/security.test.mjs",
  "resilience/resilience.test.mjs",
  "mcp/mcp-protocol.test.mjs",
  "smoke.mjs",
  "entrypoint.mjs",
];

console.log("=================================================");
console.log("  Running Merchant AI Connector Test Suite       ");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

for (const suite of testSuites) {
  const fullPath = join(__dirname, suite);
  console.log(`>>> Running [${suite}]...`);
  const res = spawnSync(process.execPath, [fullPath], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });

  if (res.status === 0) {
    passed++;
    console.log(`[PASS] ${suite}\n`);
  } else {
    failed++;
    console.error(`[FAIL] ${suite} (exit code ${res.status})\n`);
  }
}

console.log("=================================================");
console.log(`Results: ${passed} passed, ${failed} failed out of ${testSuites.length} suites.`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
