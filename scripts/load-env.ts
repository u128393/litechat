import { existsSync } from "node:fs";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

const ENV_FILES = [".env.local", ".env"] as const;

export function loadLocalEnv(cwd = process.cwd()): void {
  for (const fileName of ENV_FILES) {
    const filePath = path.resolve(cwd, fileName);

    if (existsSync(filePath)) {
      loadDotenv({ path: filePath, override: false });
    }
  }
}

loadLocalEnv();
