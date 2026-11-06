// Stable command entrypoint; implementation is shared by tooling tests.
import { main } from '../tools/export/cli.js';

main(process.argv.slice(2));
