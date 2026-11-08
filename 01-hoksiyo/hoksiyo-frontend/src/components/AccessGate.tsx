import { useState, type FormEvent } from 'react';
import { startSession } from '../api.ts';
import { describeError, GATE_NETWORK_FAILURE } from '../lib/messages.ts';

interface AccessGateProps {
  // Why the gate came back mid-use (an expired session), if it did.
  notice: string | null;
  onEnter: () => void;
}

export function AccessGate({ notice, onEnter }: AccessGateProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    const outcome = await startSession(code);
    setChecking(false);
    if (outcome === 'ok') onEnter();
    else setError(outcome === 'denied' ? describeError({ error: 'access_denied' }).message : GATE_NETWORK_FAILURE);
  }

  const message = error ?? notice;

  return (
    <form className="gate" onSubmit={handleSubmit} noValidate>
      <p className="lede">받은 피드백을 정리하려면 접속 코드를 입력하세요.</p>
      <label className="field-label" htmlFor="access-code">
        접속 코드
      </label>
      <div className="gate-row">
        <input
          id="access-code"
          className="input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={message !== null ? 'access-code-message' : undefined}
        />
        <button className="button" type="submit" disabled={checking || code.trim() === ''}>
          들어가기
        </button>
      </div>
      {message !== null ? (
        <p id="access-code-message" className="field-message" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
