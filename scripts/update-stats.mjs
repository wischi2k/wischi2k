import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Only public endpoints: never include private repositories or private activity.
const user = 'wischi2k';
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'wischi2k-profile-stats', 'X-GitHub-Api-Version': '2022-11-28' };
const token = typeof process === 'undefined' ? undefined : process.env.GITHUB_TOKEN;
if (token) headers.Authorization = `Bearer ${token}`;
async function get(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${path}`);
  return response.json();
}
const profile = await get(`/users/${user}`);
const repos = [];
for (let page = 1; ; page++) {
  const batch = await get(`/users/${user}/repos?type=owner&per_page=100&page=${page}`);
  repos.push(...batch.filter(repo => !repo.private && repo.owner.login.toLowerCase() === user));
  if (batch.length < 100) break;
}
if (repos.length !== profile.public_repos) throw new Error('Repository count changed during collection; retry later.');
const own = repos.filter(repo => !repo.fork);
const metrics = [
  ['PUBLIC REPOS', repos.length],
  ['FOLLOWERS', profile.followers],
  ['STARS', own.reduce((sum, repo) => sum + repo.stargazers_count, 0)],
  ['FORKS', own.reduce((sum, repo) => sum + repo.forks_count, 0)],
];
for (const [, value] of metrics) if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid metric');
const date = new Date().toISOString().slice(0, 10);
const cards = metrics.map(([label, value], index) => {
  const x = 24 + index * 219;
  const color = index % 2 ? '#ff70cf' : '#53e8ff';
  return `<rect x="${x}" y="72" width="207" height="100" rx="8" fill="#14182c" stroke="#303451"/><text x="${x + 18}" y="101" fill="#b7bfd6" font-size="12" letter-spacing="1">${label}</text><text x="${x + 18}" y="148" fill="${color}" font-size="35" font-weight="700">${value}</text>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="924" height="218" viewBox="0 0 924 218" role="img" aria-labelledby="title desc"><title id="title">@wischi2k – öffentliche GitHub-Statistiken</title><desc id="desc">${metrics.map(([label, value]) => `${label}: ${value}`).join(', ')}. Stand ${date} UTC.</desc><rect width="924" height="218" rx="12" fill="#0c1020"/><path d="M24 19H900" stroke="#53e8ff" stroke-width="3"/><g font-family="ui-monospace, SFMono-Regular, Consolas, monospace"><text x="24" y="50" fill="#f1f4ff" font-size="18" font-weight="700">@wischi2k / GITHUB STATS</text>${cards}<text x="24" y="199" fill="#939fbf" font-size="11">PUBLIC DATA ONLY · UPDATED ${date} UTC</text></g></svg>\n`;
const destination = fileURLToPath(new URL('../assets/github-stats.svg', import.meta.url));
await mkdir(fileURLToPath(new URL('../assets/', import.meta.url)), { recursive: true });
await writeFile(destination, svg);
console.log(JSON.stringify({ user, date, metrics }));
