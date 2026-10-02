#!/usr/bin/env node
// Removes dist/ before a build so stale files never end up in the npm package.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

rmSync(fileURLToPath(new URL('../dist', import.meta.url)), { recursive: true, force: true });
