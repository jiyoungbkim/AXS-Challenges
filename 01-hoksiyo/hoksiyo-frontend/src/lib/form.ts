import type { AnalyzeRequest, Channel } from '../types.ts';

// What the input screen holds. Kept in App so it survives every phase change.
export interface FormValues {
  projectName: string;
  sender: string;
  channel: Channel | '';
  feedback: string;
  priorFeedback: string;
}

export const EMPTY_FORM: FormValues = {
  projectName: '',
  sender: '',
  channel: '',
  feedback: '',
  priorFeedback: '',
};

// Guidance only: the backend's 400 decides (hoksiyo-backend/src/app.ts
// MAX_FEEDBACK_LENGTH, wrangler.jsonc MAX_SENTENCES).
export const FEEDBACK_MAX_LENGTH = 1_000;
export const FEEDBACK_MAX_SENTENCES = 12;

export type RequiredField = 'projectName' | 'feedback';

// Only blank required fields are stopped here; everything else goes to the backend.
export function missingFields(values: FormValues): RequiredField[] {
  const missing: RequiredField[] = [];
  if (!values.projectName.trim()) missing.push('projectName');
  if (!values.feedback.trim()) missing.push('feedback');
  return missing;
}

// Blank optional fields are left for the Worker to drop.
export function toRequest(values: FormValues): AnalyzeRequest {
  return {
    project_name: values.projectName,
    sender: values.sender,
    channel: values.channel === '' ? undefined : values.channel,
    feedback: values.feedback,
    prior_feedback: values.priorFeedback,
  };
}
