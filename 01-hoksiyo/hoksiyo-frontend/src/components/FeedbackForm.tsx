import { useState, type FormEvent } from 'react';
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MAX_SENTENCES,
  missingFields,
  type FormValues,
  type RequiredField,
} from '../lib/form.ts';
import { CHANNEL_LABEL, REQUIRED_MESSAGE } from '../lib/messages.ts';
import { splitSentences } from '../lib/sentences.ts';
import type { Channel } from '../types.ts';
import { SubmitStatus } from './SubmitStatus.tsx';

const CHANNELS: Channel[] = ['email', 'messenger', 'document'];

const FIELD_ID: Record<RequiredField, string> = {
  projectName: 'project-name',
  feedback: 'feedback',
};

const numberFormat = new Intl.NumberFormat('ko-KR');

const LENGTH_LIMIT = `${numberFormat.format(FEEDBACK_MAX_LENGTH)}자`;
const SENTENCE_LIMIT = `${FEEDBACK_MAX_SENTENCES}문장`;

function overLimitText(tooLong: boolean, tooMany: boolean): string {
  if (tooLong && tooMany) return `${LENGTH_LIMIT}와 ${SENTENCE_LIMIT}을 넘었어요.`;
  return tooLong ? `${LENGTH_LIMIT}를 넘었어요.` : `${SENTENCE_LIMIT}을 넘었어요.`;
}

interface FeedbackCounterProps {
  feedback: string;
}

// Guidance only. Length counts UTF-16 units like the backend; sentences use
// the backend's own split. Going over never disables the button.
function FeedbackCounter({ feedback }: FeedbackCounterProps) {
  const length = feedback.length;
  const sentences = splitSentences(feedback).length;
  const tooLong = length > FEEDBACK_MAX_LENGTH;
  const tooMany = sentences > FEEDBACK_MAX_SENTENCES;

  return (
    <div className="counter" id="feedback-counter">
      <p className="counter-values">
        <span className={tooLong ? 'over' : undefined}>
          {numberFormat.format(length)} / {numberFormat.format(FEEDBACK_MAX_LENGTH)}자
        </span>
        <span className={tooMany ? 'over' : undefined}>
          {sentences} / {FEEDBACK_MAX_SENTENCES}문장
        </span>
      </p>
      {tooLong || tooMany ? (
        <p className="over" role="status">
          {overLimitText(tooLong, tooMany)} 나눠서 분석하세요.
        </p>
      ) : (
        <p className="hint">문장 수는 마침표, 물음표, 느낌표, 줄바꿈으로 센 예상값이에요.</p>
      )}
    </div>
  );
}

interface FeedbackFormProps {
  values: FormValues;
  submitting: boolean;
  onChange: <K extends keyof FormValues>(field: K, value: FormValues[K]) => void;
  onSubmit: () => void;
}

export function FeedbackForm({ values, submitting, onChange, onSubmit }: FeedbackFormProps) {
  const [showMissing, setShowMissing] = useState(false);
  const [priorOpen, setPriorOpen] = useState(values.priorFeedback !== '');

  const missing = showMissing ? missingFields(values) : [];
  const isMissing = (field: RequiredField) => missing.includes(field);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const blank = missingFields(values);
    if (blank.length > 0) {
      setShowMissing(true);
      document.getElementById(FIELD_ID[blank[0]])?.focus();
      return;
    }
    onSubmit();
  }

  return (
    <form className="feedback-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="fields" disabled={submitting}>
        <div className="row">
          <label className="field-label" htmlFor="project-name">
            프로젝트명
          </label>
          <div className="field">
            <input
              id="project-name"
              className="input"
              type="text"
              placeholder="예: 《밤의 정원》 표지"
              value={values.projectName}
              onChange={(event) => onChange('projectName', event.target.value)}
              aria-invalid={isMissing('projectName')}
              aria-describedby={isMissing('projectName') ? 'project-name-message' : undefined}
            />
            {isMissing('projectName') ? (
              <p id="project-name-message" className="field-message">
                {REQUIRED_MESSAGE.projectName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="row">
          <label className="field-label" htmlFor="sender">
            전달한 사람 <span className="optional">선택</span>
          </label>
          <div className="field">
            <input
              id="sender"
              className="input"
              type="text"
              placeholder="예: 편집자"
              value={values.sender}
              onChange={(event) => onChange('sender', event.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <span className="field-label" id="channel-label">
            받은 곳 <span className="optional">선택</span>
          </span>
          <div className="field choices" role="radiogroup" aria-labelledby="channel-label">
            {CHANNELS.map((channel) => (
              <label key={channel} className="choice">
                <input
                  type="radio"
                  name="channel"
                  value={channel}
                  checked={values.channel === channel}
                  onChange={() => onChange('channel', channel)}
                />
                {CHANNEL_LABEL[channel]}
              </label>
            ))}
            <label className="choice">
              <input
                type="radio"
                name="channel"
                value=""
                checked={values.channel === ''}
                onChange={() => onChange('channel', '')}
              />
              선택 안 함
            </label>
          </div>
        </div>

        <div className="row">
          <label className="field-label" htmlFor="feedback">
            피드백 원문
          </label>
          <div className="field">
            <textarea
              id="feedback"
              className="input source"
              rows={8}
              placeholder="받은 메일이나 메시지에서 수정 피드백을 그대로 붙여넣으세요."
              value={values.feedback}
              onChange={(event) => onChange('feedback', event.target.value)}
              aria-invalid={isMissing('feedback')}
              aria-describedby={isMissing('feedback') ? 'feedback-message feedback-counter' : 'feedback-counter'}
            />
            {isMissing('feedback') ? (
              <p id="feedback-message" className="field-message">
                {REQUIRED_MESSAGE.feedback}
              </p>
            ) : null}
            <FeedbackCounter feedback={values.feedback} />
          </div>
        </div>

        <div className="row">
          <span className="field-label" aria-hidden="true" />
          <details className="field prior" open={priorOpen} onToggle={(event) => setPriorOpen(event.currentTarget.open)}>
            <summary>
              이전 피드백 붙여넣기 <span className="optional">선택</span>
            </summary>
            <p className="hint" id="prior-hint">
              “저번에 말씀드린 대로”처럼 이전 요청을 가리키는 말이 있으면 그때 받은 피드백을 붙여넣으세요.
            </p>
            <textarea
              id="prior-feedback"
              className="input source"
              rows={4}
              aria-label="이전 피드백"
              aria-describedby="prior-hint"
              value={values.priorFeedback}
              onChange={(event) => onChange('priorFeedback', event.target.value)}
            />
          </details>
        </div>
      </fieldset>

      <div className="row">
        <span className="field-label" aria-hidden="true" />
        <div className="field actions">
          <button className="button" type="submit" disabled={submitting}>
            분석하기
          </button>
          {submitting ? <SubmitStatus /> : null}
        </div>
      </div>
    </form>
  );
}
