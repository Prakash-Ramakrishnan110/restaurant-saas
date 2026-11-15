import { execSync } from "node:child_process";

export default async function globalSetup(): Promise<void> {
  // Automatically reset ephemeral table/session state via guarded Django command (DEBUG/TEST only).
  try {
    execSync("docker exec fusion_backend python manage.py reset_e2e_state", {
      stdio: "pipe",
      timeout: 30000,
    });
  } catch {
    // Non-fatal if running against a non-Docker or stubbed local server without fusion_backend container.
  }
}
