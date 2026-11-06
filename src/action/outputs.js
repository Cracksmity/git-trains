// Filesystem and GitHub workflow outputs for the Action adapter.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} directory */
export function createOutputWriter(directory) {
  mkdirSync(directory, { recursive: true });
  const files = [];
  const write = (name, svg) => {
    const path = join(directory, name);
    writeFileSync(path, svg);
    files.push(path);
    console.log(`${path} (${(svg.length / 1024).toFixed(1)} KB)`);
  };
  return { files, write };
}

/** @param {Record<string, string | number>} outputs */
export function writeActionOutputs(outputs) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
}

/** @param {Error} error */
export function reportActionError(error) {
  console.log(`::error::${error.message.replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
  process.exitCode = 1;
}
