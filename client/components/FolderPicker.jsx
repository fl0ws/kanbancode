import React, { useState, useEffect } from 'react';

export default function FolderPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(value || '');
  const [dirs, setDirs] = useState([]);
  const [parent, setParent] = useState(null);
  const [isRoot, setIsRoot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      browse(value || '~');
    }
  }, [open]);

  async function browse(path) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fs/browse?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setCurrentPath(data.path || '');
      setDirs(data.dirs || []);
      setParent(data.parent || null);
      setIsRoot(data.isRoot || false);
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function goUp() {
    if (parent) {
      browse(parent);
    } else {
      // At drive root on Windows — go to drive list
      browse('drives');
    }
  }

  function confirm() {
    onChange(currentPath);
    setOpen(false);
  }

  return (
    <div>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Select a directory..."
        />
        <button type="button" style={styles.browseBtn} onClick={() => setOpen(!open)}>
          Browse
        </button>
      </div>

      {open && (
        <div style={styles.picker}>
          <div style={styles.pathBar}>
            {(currentPath || !isRoot) && (
              <button type="button" style={styles.upBtn} onClick={goUp} title="Go up">
                ..
              </button>
            )}
            {isRoot && !currentPath && (
              <span style={styles.currentPath}>Select a drive</span>
            )}
            {currentPath && (
              <span style={styles.currentPath}>{currentPath}</span>
            )}
          </div>

          <div style={styles.dirList}>
            {loading && <div style={styles.empty}>Loading...</div>}
            {error && <div style={styles.error}>{error}</div>}
            {!loading && dirs.length === 0 && !error && (
              <div style={styles.empty}>No subdirectories</div>
            )}
            {dirs.map(dir => (
              <button
                key={dir.path}
                type="button"
                style={styles.dirItem}
                onClick={() => browse(dir.path)}
              >
                <span style={styles.folderIcon}>{isRoot && !currentPath ? '💾' : '📁'}</span>
                <span style={styles.dirName}>{dir.name}</span>
              </button>
            ))}
          </div>

          <div style={styles.pickerActions}>
            <button type="button" style={styles.cancelBtn} onClick={() => setOpen(false)}>Cancel</button>
            {currentPath && (
              <button type="button" style={styles.selectBtn} onClick={confirm}>
                Select this folder
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  inputRow: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#F5F5F5',
    color: '#212121',
    fontSize: 13,
    outline: 'none',
  },
  browseBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#FAFAFA',
    color: '#424242',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  picker: {
    marginTop: 6,
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    background: '#FFFFFF',
    overflow: 'hidden',
  },
  pathBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: '#F5F5F5',
    borderBottom: '1px solid #E0E0E0',
    minHeight: 32,
  },
  upBtn: {
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid #E0E0E0',
    background: '#FFFFFF',
    color: '#424242',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  currentPath: {
    fontSize: 12,
    color: '#757575',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  dirList: {
    maxHeight: 200,
    overflowY: 'auto',
  },
  dirItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#212121',
    textAlign: 'left',
  },
  folderIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  dirName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    color: '#9E9E9E',
  },
  error: {
    padding: '8px 10px',
    fontSize: 12,
    color: '#E53935',
  },
  pickerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    padding: '8px 10px',
    borderTop: '1px solid #E0E0E0',
  },
  cancelBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#FAFAFA',
    color: '#424242',
    fontSize: 12,
    cursor: 'pointer',
  },
  selectBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #43A047',
    background: '#4CAF50',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  },
};
