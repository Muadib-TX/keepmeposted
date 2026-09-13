const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const packageJsonPath = path.join(repoRoot, 'package.json');
const readmePath = path.join(repoRoot, 'README.md');
const commitMessagePath = process.argv[2] || null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function bumpVersion(version) {
  const parts = version.split('.').map((part) => Number(part) || 0);

  if (parts.length === 2) {
    return `${parts[0]}.${parts[1] + 1}`;
  }

  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }

  return version;
}

function readCommitMessage() {
  if (!commitMessagePath || !fs.existsSync(commitMessagePath)) {
    return '';
  }

  return fs.readFileSync(commitMessagePath, 'utf8').trim();
}

function updateReadme(version, commitMessage) {
  let readme = fs.readFileSync(readmePath, 'utf8');

  readme = readme.replace(
    /Current package version: .+/,
    `Current package version: ${version}`
  );

  const historyHeader = '## Version history';
  const historyIndex = readme.indexOf(historyHeader);

  if (historyIndex === -1) {
    return;
  }

  const recentIndex = readme.indexOf('Recent git commit history reflected in this README:');
  const insertText = `\n- ${version} — ${commitMessage || 'Automated version update'}\n`;

  if (recentIndex === -1) {
    readme += insertText;
  } else {
    readme = `${readme.slice(0, recentIndex)}${insertText}${readme.slice(recentIndex)}`;
  }

  fs.writeFileSync(readmePath, readme);
}

const packageJson = readJson(packageJsonPath);
const previousVersion = packageJson.version;
const nextVersion = bumpVersion(previousVersion);
packageJson.version = nextVersion;
writeJson(packageJsonPath, packageJson);

const commitMessage = readCommitMessage();
updateReadme(nextVersion, commitMessage);
