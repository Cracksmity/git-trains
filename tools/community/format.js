// Formatting shared by depot validation and reports.
import { sep } from 'node:path';

// --- Checks --------------------------------------------------------------------

export const posix = (p) => p.split(sep).join('/');

export const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
