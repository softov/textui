#!/usr/bin/env node
import { createCli } from './cli.js';

const code = await createCli().run(process.argv.slice(2));
process.exit(code);
