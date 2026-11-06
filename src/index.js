// Stable GitHub Action entrypoint.
import { runAction } from './action/run.js';
import { reportActionError } from './action/outputs.js';

runAction().catch(reportActionError);
