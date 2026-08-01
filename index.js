#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerAll, handleError } from './src/commands/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

program.name('weather').description('A beautiful CLI weather application').version(VERSION);

registerAll(program);
program.parseAsync().catch(handleError);