import { useEffect, useState } from 'react';
import { analyze, hasSession, type AnalyzeOutcome } from './api.ts';
import { AccessGate } from './components/AccessGate.tsx';
import { FeedbackForm } from './components/FeedbackForm.tsx';
import { TemporaryOutcome } from './components/TemporaryOutcome.tsx';
import { EMPTY_FORM, toRequest, type FormValues } from './lib/form.ts';
import { describeError } from './lib/messages.ts';

// checking: asking /api/session whether to show the gate or the form.
type Phase = 'checking' | 'gate' | 'form' | 'submitting' | 'result' | 'error';

function App() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [outcome, setOutcome] = useState<AnalyzeOutcome | null>(null);
  const [gateNotice, setGateNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void hasSession().then((ok) => {
      if (active) setPhase((current) => (current === 'checking' ? (ok ? 'form' : 'gate') : current));
    });
    return () => {
      active = false;
    };
  }, []);

  function handleChange<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    setPhase('submitting');
    const next = await analyze(toRequest(values));
    // The session expired: ask for the code again, keeping the input.
    if (next.kind === 'error' && next.body.error === 'access_required') {
      setGateNotice(describeError(next.body).message);
      setPhase('gate');
      return;
    }
    setOutcome(next);
    setPhase(next.kind === 'result' ? 'result' : 'error');
  }

  function handleEnter() {
    setGateNotice(null);
    setPhase('form');
  }

  function handleNew() {
    setValues(EMPTY_FORM);
    setOutcome(null);
    setPhase('form');
  }

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="wordmark">혹시요</h1>
        <p className="tagline">받은 수정 피드백을 작업 목록과 확인 질문으로 정리해요.</p>
      </header>
      <main>
        {phase === 'gate' ? <AccessGate notice={gateNotice} onEnter={handleEnter} /> : null}
        {phase === 'form' || phase === 'submitting' ? (
          <FeedbackForm
            values={values}
            submitting={phase === 'submitting'}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        ) : null}
        {(phase === 'result' || phase === 'error') && outcome !== null ? (
          <TemporaryOutcome
            outcome={outcome}
            onEdit={() => setPhase('form')}
            onRetry={handleSubmit}
            onNew={handleNew}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
