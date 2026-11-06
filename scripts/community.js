// Stable command entrypoint; implementation is shared by tooling tests.
import { main } from '../tools/community/cli.js';

main(process.argv.slice(2));
