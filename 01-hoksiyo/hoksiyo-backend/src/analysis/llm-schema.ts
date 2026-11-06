import * as v from 'valibot';
import { assemble } from './assemble.ts';
import { issuesToErrors, validate, validateRefs, type AnalysisInput, type ValidationError } from './validate.ts';
import { splitSentences } from './sentences.ts';

// The part of docs/analysis-schema.md the model fills. schema_version,
// project.name, items[].id, and the three counts are filled by assemble().
// Sentence fields hold 1-based numbers into splitSentences(feedback);
// assemble() turns them back into the original sentences.

const SentenceRefs = v.array(v.pipe(v.number(), v.integer()));

export const ItemSchema = v.object({
	original_text: SentenceRefs,
	request: v.string(),
	requester: v.string(),
	requester_status: v.picklist(['identified', 'unconfirmed']),
	interpretations: v.array(v.string()),
	confidence: v.picklist(['high', 'medium', 'low']),
	confidence_reason: v.string(),
	status: v.picklist(['actionable', 'needs_confirmation']),
	prior_feedback_reference: v.picklist(['matched', 'not_found', 'not_provided', 'not_applicable']),
	questions: v.array(v.string()),
});

export const LlmAnalysisSchema = v.object({
	feedback_context: v.object({
		channel: v.picklist(['email', 'messenger', 'document', 'unknown']),
		sender: v.string(),
	}),
	analysis: v.object({
		input_type: v.picklist(['revision_feedback', 'no_revision_request', 'out_of_scope']),
		summary: v.string(),
	}),
	items: v.array(ItemSchema),
	validation: v.object({
		unmatched_text: SentenceRefs,
		non_request_text: SentenceRefs,
		missing_information: v.array(v.string()),
		notes: v.array(v.string()),
	}),
});

export type LlmAnalysis = v.InferOutput<typeof LlmAnalysisSchema>;

// The `finish` schema for harness.prompt. The rawCheck runs on every finish
// call, even when the base object fails, so each call is reported to
// `onAttempt` once. Invariant failures go back to the model as finish errors.
export function buildResultSchema(input: AnalysisInput, onAttempt: (errors: ValidationError[]) => void) {
	return v.pipe(
		LlmAnalysisSchema,
		v.rawCheck(({ dataset, addIssue }) => {
			if (!dataset.typed) {
				onAttempt(issuesToErrors(dataset.issues ?? []));
				return;
			}
			const refErrors = validateRefs(dataset.value, splitSentences(input.feedback).length);
			const errors = refErrors.length > 0 ? refErrors : validate(assemble(input, dataset.value), input).errors;
			onAttempt(errors);
			for (const error of errors) addIssue({ message: `[조건 ${error.cond}] ${error.message}` });
		}),
	);
}
