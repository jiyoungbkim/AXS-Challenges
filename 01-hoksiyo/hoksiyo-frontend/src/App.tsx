import { useEffect, useState } from 'react';
import { analyze, hasSession, type AnalyzeOutcome } from './api.ts';
import { AccessGate } from './components/AccessGate.tsx';
import { ErrorNotice } from './components/ErrorNotice.tsx';
import { FeedbackForm } from './components/FeedbackForm.tsx';
import { ResultView } from './components/ResultView.tsx';
import { EMPTY_FORM, toRequest, type FormValues } from './lib/form.ts';
import { describeError } from './lib/messages.ts';

// checking: asking /api/session whether to show the gate or the form.
type Phase = 'checking' | 'gate' | 'form' | 'submitting' | 'done';

// The last analysis and the feedback it was made from, kept apart from the
// form so editing the form never changes a result on screen.
interface Analyzed {
  feedback: string;
  outcome: AnalyzeOutcome;
}

function App() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [analyzed, setAnalyzed] = useState<Analyzed | null>(null);
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
    const request = toRequest(values);
    const outcome = await analyze(request);
    // The session expired: ask for the code again, keeping the input.
    if (outcome.kind === 'error' && outcome.body.error === 'access_required') {
      setGateNotice(describeError(outcome.body).message);
      setPhase('gate');
      return;
    }
    setAnalyzed({ feedback: request.feedback, outcome });
    setPhase('done');
    window.scrollTo({ top: 0 });
  }

  function handleEnter() {
    setGateNotice(null);
    setPhase('form');
  }

  function handleEdit() {
    setPhase('form');
  }

  function handleNew() {
    setValues(EMPTY_FORM);
    setAnalyzed(null);
    setPhase('form');
  }

  const outcome = phase === 'done' ? (analyzed?.outcome ?? null) : null;

  return (
    <div className={outcome?.kind === 'result' ? 'page wide' : 'page'}>
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
        {analyzed !== null && outcome !== null ? (
          outcome.kind === 'result' ? (
            <ResultView
              feedback={analyzed.feedback}
              result={outcome.result}
              meta={outcome.meta}
              onEdit={handleEdit}
              onNew={handleNew}
            />
          ) : (
            <ErrorNotice outcome={outcome} onRetry={handleSubmit} onEdit={handleEdit} />
          )
        ) : null}
      </main>
    </div>
  );
}

export default App;
