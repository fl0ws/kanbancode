import React, { useState, useEffect } from 'react';
import { configurePool, saveSetting, fetchHealth } from '../api.js';
import { useStore } from '../store.js';

export default function SettingsModal({ onClose, zoom, setZoom }) {
  const poolStatus = useStore(s => s.poolStatus);
  const setPoolStatus = useStore(s => s.setPoolStatus);
  const notificationSoundEnabled = useStore(s => s.notificationSoundEnabled);
  const setNotificationSoundEnabled = useStore(s => s.setNotificationSoundEnabled);
  const [maxConcurrency, setMaxConcurrency] = useState(poolStatus.maxConcurrency || 3);
  const [configDir, setConfigDir] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const defaultSystemPrompt = `Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence.
Use subagents for any exploration or research. If a task needs 3+ files or multi-file analysis, spawn a subagent and return only summarized insights.
Complete the task described above. When finished, provide a summary of what you did.`;

  useEffect(() => {
    fetch('/api/settings/claudeConfigDir')
      .then(r => r.json())
      .then(data => { if (data.value) setConfigDir(data.value); })
      .catch(() => {});
    fetch('/api/settings/systemPrompt')
      .then(r => r.json())
      .then(data => { setSystemPrompt(data.value || ''); })
      .catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const num = Number(maxConcurrency);
      if (!num || num < 1) throw new Error('Max concurrency must be at least 1');

      await configurePool(num);
      setPoolStatus({ ...poolStatus, maxConcurrency: num });

      await saveSetting('claudeConfigDir', configDir.trim());
      await saveSetting('systemPrompt', systemPrompt.trim());

      setMessage({ type: 'success', text: 'Settings saved' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.heading}>Settings</h2>
          <button style={styles.closeBtn} onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave}>
          <label style={styles.label}>
            Max Concurrent Claude Processes
            <input
              type="number"
              min="1"
              max="20"
              style={styles.input}
              value={maxConcurrency}
              onChange={e => setMaxConcurrency(e.target.value)}
            />
            <span style={styles.hint}>
              Tasks beyond this limit are queued automatically.
            </span>
          </label>

          <label style={styles.label}>
            Claude Config Directory
            <input
              style={styles.input}
              value={configDir}
              onChange={e => setConfigDir(e.target.value)}
              placeholder="e.g. ~/.claude-work or C:\Users\you\.claude-work"
            />
            <span style={styles.hint}>
              Sets CLAUDE_CONFIG_DIR when spawning Claude processes.
              Useful for separating kanban agent configs (e.g. ~/.claude-work).
            </span>
          </label>

          <label style={styles.label}>
            System Prompt
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder={defaultSystemPrompt}
              rows={6}
            />
            <span style={styles.hint}>
              Instructions added to the initial prompt when a task first runs.
              Leave empty to use the default. Not included on conversation resumes.
            </span>
            {!systemPrompt.trim() && (
              <button
                type="button"
                style={styles.resetBtn}
                onClick={() => setSystemPrompt(defaultSystemPrompt)}
              >
                Load default
              </button>
            )}
          </label>

          <label style={styles.label}>
            Display Zoom: {zoom}%
            <div style={styles.sliderRow}>
              <span style={styles.sliderLabel}>80%</span>
              <input
                type="range"
                min="80"
                max="150"
                step="5"
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderLabel}>150%</span>
            </div>
            <span style={styles.hint}>
              Scales the entire interface. Useful for high-DPI screens or accessibility.
            </span>
          </label>

          <div style={styles.toggleRow}>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={notificationSoundEnabled}
                onChange={e => setNotificationSoundEnabled(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.toggleText}>Notification Sound</span>
            </label>
            <span style={styles.toggleHint}>
              Play a chime when Claude completes a task or needs your input
            </span>
          </div>

          {message && (
            <p style={{ ...styles.message, color: message.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
              {message.text}
            </p>
          )}

          <div style={styles.actions}>
            <button type="button" style={styles.btn} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-surface)',
    border: 'none',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    width: 520,
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    fontFamily: 'var(--font-headline)',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 500,
    marginBottom: 16,
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    font: 'inherit',
    outline: 'none',
  },
  textarea: {
    resize: 'vertical',
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: 12,
    lineHeight: 1.5,
  },
  hint: {
    display: 'block',
    marginTop: 4,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  resetBtn: {
    marginTop: 6,
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-tertiary)',
    fontSize: 11,
    cursor: 'pointer',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  slider: {
    flex: 1,
    cursor: 'pointer',
    accentColor: 'var(--blue)',
  },
  sliderLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  message: {
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontFamily: 'var(--font-headline)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
  },
  toggleRow: {
    marginBottom: 16,
    padding: '12px 14px',
    background: 'var(--bg-sidebar)',
    borderRadius: 'var(--radius-md)',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    marginBottom: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: 'var(--green)',
    cursor: 'pointer',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  toggleHint: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-muted)',
    marginLeft: 24,
    lineHeight: 1.4,
  },
};
