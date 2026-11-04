// npm 11 may serialize file overrides relative to each transitive consumer.
// Keep the vendored packages rooted in this repository for npm ci.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(filename, 'utf8'));
for (const [location, entry] of Object.entries(lock.packages)) {
  if (location.includes('/scripts/dependency-compat/')) {
    delete lock.packages[location];
  } else if (entry.link && entry.resolved.includes('/scripts/dependency-compat/')) {
    entry.resolved = 'scripts/dependency-compat/' + path.posix.basename(entry.resolved);
  }
}
for (const folder of fs.readdirSync(path.join(root, 'scripts/dependency-compat'))) {
  const relative = 'scripts/dependency-compat/' + folder;
  const manifest = path.join(root, relative, 'package.json');
  if (fs.existsSync(manifest)) lock.packages[relative] = JSON.parse(fs.readFileSync(manifest, 'utf8'));
}
fs.writeFileSync(filename, JSON.stringify(lock, null, 2) + '\n');
