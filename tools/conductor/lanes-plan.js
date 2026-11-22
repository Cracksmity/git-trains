// The plan for lanes.js, and the pure parts of running it: which tasks go in which
// lane, the branch each lane builds, which agent did a task, and the summary table.

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_LANES = 8;

/**
 * @typedef {object} Lane
 * @property {string} name a slug; the lane's branch is lanes/<plan>/<name>
 * @property {string[]} tasks task files, relative to the plan file, run in this order
 * @property {'stop' | 'continue'} onFailure after a task fails: skip the rest of the lane
 *   (the default, for tasks that build on each other) or go on with the next one
 */

/**
 * @typedef {object} Plan
 * @property {string} name a slug for the branches and the logs
 * @property {Lane[]} lanes run at the same time
 * @property {string[]} checks shell commands run in a lane after each task it applies;
 *   their results are recorded, not enforced (the task's gates already passed)
 */

/**
 * Reads and validates a plan, collecting every problem.
 * @param {string} text the plan's JSON
 * @returns {Plan}
 */
export function readPlan(text) {
  /** @type {any} */
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`The plan is not JSON: ${/** @type {Error} */ (error).message}`);
  }
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The plan must be a JSON object');
  if (typeof raw.name !== 'string' || !SLUG.test(raw.name)) problems.push('"name" must be a lower-case slug such as "weather"');
  const lanes = Array.isArray(raw.lanes) ? raw.lanes : [];
  if (lanes.length < 1 || lanes.length > MAX_LANES) problems.push(`"lanes" must list 1 to ${MAX_LANES} lanes`);
  const names = new Set();
  const owner = new Map();
  lanes.forEach((lane, i) => {
    const where = `lane ${i + 1}`;
    if (typeof lane?.name !== 'string' || !SLUG.test(lane.name)) problems.push(`${where}: "name" must be a lower-case slug`);
    else if (names.has(lane.name)) problems.push(`${where}: the name "${lane.name}" is used twice`);
    else names.add(lane.name);
    const tasks = Array.isArray(lane?.tasks) ? lane.tasks : [];
    if (!tasks.length) problems.push(`${where}: "tasks" must list at least one task file`);
    for (const task of tasks) {
      if (typeof task !== 'string' || !task.endsWith('.json')) problems.push(`${where}: ${JSON.stringify(task)} is not a task file (.json)`);
      // Two lanes on one task would write the same patch and logs at the same time.
      else if (owner.has(task)) problems.push(`${where}: ${task} is already in lane ${owner.get(task)}`);
      else owner.set(task, i + 1);
    }
    if (lane?.onFailure !== undefined && !['stop', 'continue'].includes(lane.onFailure)) {
      problems.push(`${where}: "onFailure" must be "stop" or "continue"`);
    }
  });
  const checks = raw.checks ?? [];
  if (!Array.isArray(checks) || checks.some((c) => typeof c !== 'string' || !c.trim())) problems.push('"checks" must be a list of commands');
  if (problems.length) throw new Error(`The plan has ${problems.length} problem(s):\n${problems.map((p) => `- ${p}`).join('\n')}`);
  return {
    name: raw.name,
    lanes: lanes.map((lane) => ({ name: lane.name, tasks: [...lane.tasks], onFailure: lane.onFailure ?? 'stop' })),
    checks: [...checks],
  };
}

/** The branch a lane commits to. @param {string} plan @param {string} lane */
export const laneBranch = (plan, lane) => `lanes/${plan}/${lane}`;

/**
 * The agent that ran a task, and how many attempts it took, read from the conductor's
 * output: the last "rung r/n, attempt a/b: <agent>" line, or the dry run's "would run".
 * @param {string} output
 * @returns {{ agent: string, attempts: number }}
 */
export function agentOf(output) {
  const runs = [...output.matchAll(/rung \d+\/\d+, attempt (\d+)\/\d+: (.+?)\s*$/gm)];
  if (runs.length) return { agent: runs[runs.length - 1][2], attempts: runs.length };
  const dry = /would run (.+?): /.exec(output);
  return { agent: dry ? dry[1] : 'unknown', attempts: 0 };
}

/**
 * @typedef {object} TaskResult
 * @property {string} lane
 * @property {string} task the task's file name, without .json
 * @property {'passed' | 'failed' | 'skipped' | 'dry run'} status
 * @property {string} [agent]
 * @property {number} [attempts]
 * @property {number} [minutes]
 * @property {Record<string, boolean>} [checks] each plan check, and whether it passed
 * @property {string} [commit] the short hash committed to the lane's branch
 * @property {string} [note]
 */

/**
 * The results as a Markdown table, one row per task in lane order.
 * @param {TaskResult[]} rows
 * @param {string[]} checks the plan's checks, one column each
 */
export function summaryTable(rows, checks) {
  const head = ['Lane', 'Task', 'Agent', 'Result', 'Attempts', 'Minutes', ...checks, 'Commit'];
  const cell = (value) => String(value ?? '-').replace(/\|/g, '\\|');
  const lines = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`];
  for (const r of rows) {
    const results = checks.map((c) => (r.checks && c in r.checks ? (r.checks[c] ? 'ok' : 'FAILED') : '-'));
    const result = r.note ? `${r.status} (${r.note})` : r.status;
    lines.push(`| ${[r.lane, r.task, r.agent, result, r.attempts, r.minutes, ...results, r.commit].map(cell).join(' | ')} |`);
  }
  return lines.join('\n');
}
