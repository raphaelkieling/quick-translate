// Computes the next version and release notes from conventional commits since the last tag.
// Used by .github/workflows/release.yml; writes `version`, `tag` and `skip` to $GITHUB_OUTPUT
// and the changelog to release-notes.md.
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const repoUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;

let lastTag = '';
try {
  lastTag = git('describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"');
} catch {}

const SEP = '\x1f';
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const commits = git(`log ${range} --no-merges --format=%H${SEP}%s${SEP}%b%x1e`)
  .split('\x1e')
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [sha, subject, body = ''] = c.split(SEP);
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    return {
      sha,
      type: m ? m[1].toLowerCase() : 'other',
      scope: m?.[2],
      breaking: Boolean(m?.[3]) || /BREAKING CHANGE/.test(body),
      text: m ? m[4] : subject,
    };
  });

const output = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
};

if (lastTag && commits.length === 0) {
  output('skip', 'true');
  process.exit(0);
}

let version;
if (!lastTag) {
  version = JSON.parse(readFileSync('package.json', 'utf8')).version;
} else {
  let [major, minor, patch] = lastTag.slice(1).split('.').map(Number);
  if (commits.some((c) => c.breaking)) [major, minor, patch] = [major + 1, 0, 0];
  else if (commits.some((c) => c.type === 'feat')) [minor, patch] = [minor + 1, 0];
  else patch += 1;
  version = `${major}.${minor}.${patch}`;
}

const sections = [
  ['⚠️ Breaking changes', (c) => c.breaking],
  ['✨ Features', (c) => c.type === 'feat'],
  ['🐛 Fixes', (c) => c.type === 'fix'],
  ['⚡ Performance', (c) => c.type === 'perf'],
  ['🔧 Other changes', () => true],
];

const used = new Set();
let notes = '';
for (const [title, match] of sections) {
  const items = commits.filter((c) => !used.has(c.sha) && match(c));
  if (!items.length) continue;
  notes += `### ${title}\n\n`;
  for (const c of items) {
    used.add(c.sha);
    const scope = c.scope ? `**${c.scope}:** ` : '';
    notes += `- ${scope}${c.text} ([${c.sha.slice(0, 7)}](${repoUrl}/commit/${c.sha}))\n`;
  }
  notes += '\n';
}

notes += `### Install

Download the zip for your Mac (\`arm64\` for Apple Silicon, \`x64\` for Intel), unzip it and move **QuickTranslate.app** to \`/Applications\`.
The app is not signed, so the first time run:

\`\`\`sh
xattr -cr /Applications/QuickTranslate.app
\`\`\`
`;

if (lastTag) notes += `\n**Full changelog:** ${repoUrl}/compare/${lastTag}...v${version}\n`;

writeFileSync('release-notes.md', notes);
output('skip', 'false');
output('version', version);
output('tag', `v${version}`);
