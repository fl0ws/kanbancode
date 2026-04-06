import React, { useState } from 'react';
import { logActivity, moveTask, stopTask } from '../api.js';
import { useStore } from '../store.js';

export default function QuestionPanel({ taskId, questions }) {
  const clearPendingQuestions = useStore(s => s.clearPendingQuestions);
  const [answers, setAnswers] = useState({});
  const [customTexts, setCustomTexts] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function selectOption(qIndex, label) {
    setAnswers(prev => ({ ...prev, [qIndex]: label }));
    setCustomTexts(prev => ({ ...prev, [qIndex]: '' }));
  }

  function setCustom(qIndex, text) {
    setCustomTexts(prev => ({ ...prev, [qIndex]: text }));
    setAnswers(prev => ({ ...prev, [qIndex]: null }));
  }

  function getAnswer(qIndex) {
    if (customTexts[qIndex]?.trim()) return customTexts[qIndex].trim();
    return answers[qIndex] || null;
  }

  const allAnswered = questions.every((_, i) => getAnswer(i) !== null);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Build a clear response message
      const parts = questions.map((q, i) => {
        const answer = getAnswer(i);
        return `${q.question}\nAnswer: ${answer}`;
      });
      const message = parts.join('\n\n');

      // Stop the current process (it's stuck on the failed AskUserQuestion)
      try { await stopTask(taskId); } catch {}

      // Log the answers and resume
      await logActivity(taskId, 'user', message);
      await moveTask(taskId, 'claude');
      clearPendingQuestions(taskId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>?</span>
        <span style={styles.title}>Claude has questions</span>
      </div>

      <div style={styles.scrollArea}>
      {questions.map((q, qIndex) => (
        <div key={qIndex} style={styles.question}>
          {q.header && <span style={styles.chip}>{q.header}</span>}
          <p style={styles.questionText}>{q.question}</p>

          <div style={styles.options}>
            {q.options.map((opt, oIndex) => {
              const selected = answers[qIndex] === opt.label && !customTexts[qIndex]?.trim();
              return (
                <button
                  key={oIndex}
                  style={{
                    ...styles.option,
                    ...(selected ? styles.optionSelected : {}),
                  }}
                  onClick={() => selectOption(qIndex, opt.label)}
                >
                  <span style={styles.optionLabel}>{opt.label}</span>
                  {opt.description && (
                    <span style={styles.optionDesc}>{opt.description}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={styles.customRow}>
            <input
              style={styles.customInput}
              value={customTexts[qIndex] || ''}
              onChange={e => setCustom(qIndex, e.target.value)}
              placeholder="Or type a custom answer..."
            />
          </div>
        </div>
      ))}
      </div>

      <div style={styles.actions}>
        <button
          style={{ ...styles.submitBtn, ...(!allAnswered ? styles.submitDisabled : {}) }}
          disabled={!allAnswered || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Sending...' : 'Send Answers'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    margin: '12px 0',
    borderRadius: 10,
    border: '1px solid var(--blue-border)',
    background: 'var(--blue-bg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 400,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid var(--blue-border)',
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--blue)',
    color: 'var(--text-on-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--blue-dark)',
  },
  question: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--blue-border)',
  },
  chip: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    background: 'var(--blue)',
    color: 'var(--text-on-accent)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  questionText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 12px',
    borderRadius: 8,
    border: '2px solid var(--blue-border)',
    background: 'var(--bg-surface)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
  },
  optionSelected: {
    borderColor: 'var(--blue)',
    background: 'var(--blue-bg)',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  optionDesc: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    lineHeight: 1.3,
  },
  customRow: {
    marginTop: 8,
  },
  customInput: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--blue-border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
  },
  actions: {
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitBtn: {
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--blue)',
    color: 'var(--text-on-accent)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  submitDisabled: {
    background: 'var(--blue-light)',
    cursor: 'not-allowed',
  },
};
