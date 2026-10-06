import { rm } from "node:fs/promises";

// Resolve only the project's development cache, independent of the shell/cwd.
await rm(new URL("../.next/dev/", import.meta.url), { recursive: true, force: true });
