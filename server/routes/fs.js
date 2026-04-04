import { Router } from 'express';
import { readdirSync } from 'fs';
import { join, parse, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const router = Router();

// Get available drives on Windows
function getWindowsDrives() {
  try {
    // Use PowerShell — wmic is deprecated/unavailable on newer Windows
    const output = execSync(
      'powershell.exe -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"',
      { encoding: 'utf-8', windowsHide: true }
    );
    const drives = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[A-Z]:\\$/.test(line))
      .map(drive => ({
        name: drive.slice(0, 2),
        path: drive,
      }));
    return drives.length > 0 ? drives : [{ name: 'C:', path: 'C:\\' }];
  } catch {
    return [{ name: 'C:', path: 'C:\\' }];
  }
}

router.get('/api/fs/browse', (req, res) => {
  const isWindows = process.platform === 'win32';

  // Special path "drives" returns available drives on Windows
  if (req.query.path === 'drives') {
    if (isWindows) {
      return res.json({ path: '', dirs: getWindowsDrives(), isRoot: true });
    }
    return res.json({ path: '/', dirs: [], isRoot: true });
  }

  let dirPath = req.query.path || homedir();

  // Expand ~
  if (dirPath.startsWith('~')) {
    dirPath = dirPath.replace(/^~/, homedir());
  }

  // Resolve to absolute path
  dirPath = resolve(dirPath);

  // Check if we're at a filesystem root
  const parsed = parse(dirPath);
  const isAtRoot = dirPath === parsed.root;

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const dirs = entries
      .filter(e => {
        if (!e.isDirectory()) return false;
        if (e.name.startsWith('.')) return false;
        if (e.name === 'node_modules') return false;
        if (e.name === '$Recycle.Bin') return false;
        if (e.name === 'System Volume Information') return false;
        return true;
      })
      .map(e => ({
        name: e.name,
        path: join(dirPath, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      path: dirPath,
      dirs,
      isRoot: isAtRoot,
      parent: isAtRoot ? null : parse(dirPath).dir,
    });
  } catch (err) {
    res.status(400).json({ error: err.message, path: dirPath, dirs: [] });
  }
});

export default router;
