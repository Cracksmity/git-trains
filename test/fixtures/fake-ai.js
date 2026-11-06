// A stand-in for codex, agy and claude, used by test/design.test.js. Started as
//   node fake-ai.js <codex|gemini|claude> <the CLI's own arguments>
// it answers like that CLI would in headless mode, with canned answers read from the
// scenario file named by FAKE_AI_SCENARIO: { "answers": [text | null, ...], "fail": { "code", "stderr" } }.
// Run number n gets answers[n] (the last one repeats); null is an empty answer.
// Every run is appended to FAKE_AI_LOG as one JSON line: arguments, stdin, working
// folder and what was in it, so tests can check how the agent was started.
// (node --test also runs every .js file under test/; with no arguments this exits quietly.)

import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const [kind, ...args] = process.argv.slice(2);
if (!kind) process.exit(0);

if (args.includes('--version')) {
  console.log(`fake-${kind} 1.0.0`);
  process.exit(0);
}

const scenarioFile = process.env.FAKE_AI_SCENARIO;
const scenario = JSON.parse(readFileSync(scenarioFile, 'utf8'));
const countFile = `${scenarioFile}.count`;
const n = existsSync(countFile) ? Number(readFileSync(countFile, 'utf8')) : 0;
writeFileSync(countFile, String(n + 1));

let stdin = '';
if (kind !== 'gemini') for await (const chunk of process.stdin) stdin += chunk;
const files = readdirSync('.', { recursive: true }).map((f) => String(f).replaceAll('\\', '/')).sort();
const taskFile = kind === 'gemini' && existsSync('task.md') ? readFileSync('task.md', 'utf8') : null;
appendFileSync(process.env.FAKE_AI_LOG, `${JSON.stringify({ kind, n, args, stdin, cwd: process.cwd(), files, task: taskFile })}\n`);

if (scenario.fail) {
  console.error(scenario.fail.stderr ?? 'failed');
  process.exit(scenario.fail.code ?? 1);
}

const text = scenario.answers[Math.min(n, scenario.answers.length - 1)];
const usage = { output_tokens: 1234 };
if (kind === 'codex') {
  console.log('{"type":"thread.started","thread_id":"t"}');
  console.log('WARN a plugin printed a line that is not JSON');
  console.log('{"type":"turn.started"}');
  if (text !== null) console.log(JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text } }));
  console.log(JSON.stringify({ type: 'turn.completed', usage }));
} else if (kind === 'gemini') {
  console.error('jetski: a warning before the result');
  console.log(JSON.stringify({ conversation_id: 'c', status: 'SUCCESS', response: text ?? '', usage, ...(text === null ? { denied_actions: [{ display_name: 'RunCommand' }] } : {}) }));
} else {
  console.log(JSON.stringify({ type: 'result', is_error: false, result: text ?? '', usage }));
}
