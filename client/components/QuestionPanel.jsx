import React, { useState } from 'react';
import { logActivity, moveTask, stopTask } from '../api.js';
import { useStore } from '../store.js';

export default function QuestionPanel({ taskId, questions }) {
  const clearPendingQuestions = useStore(s => s.clearPendingQuestions);
  const [answers, setAnswers] = useState({});
  const [customTexts, setCustomTexts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [hoveredOption, setHoveredOption] = useState(null);

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
                    ...(!selected && hoveredOption === `${qIndex}-${oIndex}` ? { background: 'var(--bg-elevated)' } : {}),
                  }}
                  onClick={() => selectOption(qIndex, opt.label)}
                  onMouseEnter={() => setHoveredOption(`${qIndex}-${oIndex}`)}
                  onMouseLeave={() => setHoveredOption(null)}
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
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-sidebar)',
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
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--fs-body)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  question: {
    padding: '12px 14px',
  },
  chip: {
    display: 'inline-block',
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--blue)',
    color: 'var(--text-on-accent)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  questionText: {
    fontSize: 'var(--fs-body)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
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
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-surface)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  optionSelected: {
    background: 'var(--green-bg)',
    color: 'var(--green)',
  },
  optionLabel: {
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    color: 'inherit',
  },
  optionDesc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-tertiary)',
    lineHeight: 1.3,
  },
  customRow: {
    marginTop: 8,
  },
  customInput: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-small)',
    outline: 'none',
  },
  actions: {
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitBtn: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    fontSize: 'var(--fs-body)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  submitDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
