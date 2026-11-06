// community/report.js: focused report operations.


import { formatProblems } from './validation.js';
import { count } from './format.js';

// --- Report --------------------------------------------------------------------

export const MARKER = '<!-- git-trains-community -->';

const COMMENT_MAX = 50000;

// characters; GitHub allows 65,536 and some take several bytes

// The report as Markdown. links: { sheet, zip } artifact URLs; site: the Pages root
// for the studio links; readme: the depot rules. Long problem lists and studio
// links are dropped before the text outgrows a comment.
/** @param {any} report @param {{sheet?: string, zip?: string, site?: string, readme?: string}} options */
export function reportMarkdown(report, { sheet, zip, site, readme = 'community/README.md' } = {}) {
  const lines = [MARKER, '### Community depot', ''];
  const n = report.problems.reduce((a, p) => a + p.problems.length, 0);
  if (n) {
    lines.push(`**${count(n, 'problem')} in ${count(report.problems.length, 'file')}.** Fix ${n === 1 ? 'it' : 'them'} and push again; this comment updates itself. The list is worded so you can paste it back to the AI that wrote the file.`, '');
    lines.push('```text', formatProblems(report.problems), '```', '');
  } else {
    lines.push(`**All ${count(report.files, 'file')} in the depot pass the checks.**`, '');
  }

  if (report.previews.length) {
    lines.push('| | File | Name | Author | |', '| --- | --- | --- | --- | --- |');
    for (const p of report.previews) {
      const studio = site ? `[Open in the studio](${site}${p.share})` : '';
      // A profile link rather than an @mention: the comment should not ping anyone.
      lines.push(`| ${p.kind} | \`${p.file}\` | ${p.name.replace(/\|/g, '\\|')} | [${p.author}](https://github.com/${p.author}) | ${studio} |`);
    }
    lines.push('');
    const what = report.previews.some((p) => p.kind === 'train')
      ? 'light and dark scenes with sample stats, and the mini train from calendar mode'
      : 'light and dark scenes, behind a catalog train';
    const sheetLink = sheet ? `**[${report.sheet}](${sheet})**` : `\`${report.sheet}\``;
    const zipLink = zip ? `[every image on its own (zip)](${zip})` : 'every image on its own';
    lines.push(`Previews: ${sheetLink} (${what}) and ${zipLink}, with the animated calendar SVGs. Drawn with sample stats: ${report.sample.train.total.toLocaleString('en')} contributions for trains and ${report.sample.skyline.total.toLocaleString('en')} for skylines, a ${report.sample.train.streak}-day streak.`, '');
  } else if (!report.changed.length) {
    lines.push('No train or skyline file changed in this pull request, so there is nothing to preview.', '');
  }
  if (report.skipped.length) {
    lines.push(`Not drawn because of the problems above: ${report.skipped.map((f) => `\`${f}\``).join(', ')}.`, '');
  }
  if (report.changed.length > 1) {
    lines.push(`This pull request changes ${count(report.changed.length, 'file')}; the depot asks for one train or skyline per pull request, so each one can be reviewed and credited on its own.`, '');
  }
  lines.push(`Before merging, check the [depot rules](${readme}): no logos or lettering, a description of the real train or city, one train or skyline per pull request.`);

  let text = lines.join('\n');
  if (text.length > COMMENT_MAX) text = text.replace(/\[Open in the studio\]\([^)]*\)/g, '');
  if (text.length > COMMENT_MAX) text = `${text.slice(0, COMMENT_MAX)}\n\n(cut short: see the job log for everything)`;
  return text;
}
