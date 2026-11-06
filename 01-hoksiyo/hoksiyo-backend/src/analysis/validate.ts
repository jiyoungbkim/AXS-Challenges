import type { BaseIssue } from 'valibot';
import type { AnalysisResult } from './assemble.ts';
import { splitSentences } from './sentences.ts';

// Checks the error conditions of docs/analysis-schema.md 6장. Conditions 6
// (enum values) and 7 (required fields) come from the Valibot parse through
// issuesToErrors(); 14 and 15 are reviewed by hand.

export interface AnalysisInput {
	project_line: string;
	feedback: string;
	prior_feedback?: string;
}

export interface ValidationError {
	cond: number | 'schema' | 'parse';
	message: string;
}

export interface ValidationReport {
	errors: ValidationError[];
	warnings: string[];
}

const ENUM_ISSUE_TYPES = new Set(['picklist', 'enum', 'literal']);

export function normalize(text: string): string {
	return text
		.replace(/[“”„‟″]/g, '"')
		.replace(/[‘’‚‛′]/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

function issuePath(issue: BaseIssue<unknown>): string {
	return issue.path?.map((item) => String(item.key)).join('.') ?? '';
}

export function issuesToErrors(issues: readonly BaseIssue<unknown>[]): ValidationError[] {
	return issues.map((issue) => {
		const path = issuePath(issue);
		return {
			cond: ENUM_ISSUE_TYPES.has(issue.type) ? 6 : 7,
			message: path ? `${issue.message} (at ${path})` : issue.message,
		};
	});
}

export function validate(result: AnalysisResult, input: AnalysisInput): ValidationReport {
	const errors: ValidationError[] = [];
	const warnings: string[] = [];
	const fail = (cond: number, message: string) => errors.push({ cond, message });
	const { analysis, items, validation } = result;

	if (result.schema_version !== '1.0') fail(1, `schema_version은 "1.0"이어야 합니다: ${result.schema_version}`);

	if (analysis.total_items !== items.length) {
		fail(2, `total_items(${analysis.total_items})와 items.length(${items.length})가 다릅니다.`);
	}

	const actionable = items.filter((item) => item.status === 'actionable').length;
	const confirmation = items.filter((item) => item.status === 'needs_confirmation').length;
	if (analysis.actionable_count !== actionable || analysis.confirmation_count !== confirmation) {
		fail(3, '집계값이 items의 status 개수와 다릅니다.');
	}

	if (analysis.input_type === 'revision_feedback' && items.length === 0) {
		fail(4, 'input_type이 revision_feedback이면 items가 1개 이상이어야 합니다.');
	}
	if (analysis.input_type !== 'revision_feedback' && items.length > 0) {
		fail(4, `input_type이 ${analysis.input_type}이면 items는 빈 배열이어야 합니다.`);
	}

	items.forEach((item, index) => {
		if (item.id !== index + 1) fail(5, `items[${index}].id는 ${index + 1}이어야 합니다: ${item.id}`);
	});

	const sentences = splitSentences(input.feedback).map(normalize);
	const sentenceSet = new Set(sentences);
	const recorded = [
		...items.flatMap((item) => item.original_text),
		...validation.non_request_text,
		...validation.unmatched_text,
	].map(normalize);
	for (const text of recorded) {
		if (!sentenceSet.has(text)) fail(8, `입력 원문에 없는 문장입니다: "${text}"`);
	}

	items.forEach((item) => {
		if (item.status === 'needs_confirmation' && item.questions.length === 0) {
			fail(9, `항목 ${item.id}은 needs_confirmation이므로 질문이 1개 이상 있어야 합니다.`);
		}
		if (item.status === 'actionable' && item.questions.length > 0) {
			fail(9, `항목 ${item.id}은 actionable이므로 questions가 []이어야 합니다.`);
		}
		if (item.requester_status === 'identified' && item.requester === 'unknown') {
			fail(10, `항목 ${item.id}: identified인데 requester가 "unknown"입니다.`);
		}
		if (item.requester_status === 'unconfirmed' && item.requester !== 'unknown') {
			fail(10, `항목 ${item.id}: unconfirmed이면 requester는 "unknown"이어야 합니다.`);
		}
	});

	const hasPrior = Boolean(input.prior_feedback?.trim());
	items.forEach((item) => {
		const ref = item.prior_feedback_reference;
		if (!hasPrior && (ref === 'matched' || ref === 'not_found')) {
			fail(11, `항목 ${item.id}: 이전 피드백이 없는데 ${ref}를 썼습니다.`);
		}
		if (hasPrior && ref === 'not_provided') {
			fail(11, `항목 ${item.id}: 이전 피드백이 있는데 not_provided를 썼습니다.`);
		}
	});

	const recordedSet = new Set(recorded);
	for (const sentence of sentences) {
		if (!recordedSet.has(sentence)) {
			fail(12, `어디에도 기록되지 않은 원문 문장입니다: "${sentence}"`);
		}
	}

	if (hasPrior) {
		const priorSentences = new Set(splitSentences(input.prior_feedback ?? '').map(normalize));
		const current = new Set(sentences);
		for (const item of items) {
			for (const text of item.original_text.map(normalize)) {
				if (priorSentences.has(text) && !current.has(text)) {
					fail(13, `항목 ${item.id}에 이전 피드백 문장이 섞였습니다: "${text}"`);
				}
			}
		}
	}

	for (const item of items) {
		if (item.confidence === 'low' && item.status === 'actionable') {
			warnings.push(`항목 ${item.id}: low인데 actionable`);
		}
		const count = item.interpretations.length;
		if (count === 1 || count >= 5) warnings.push(`항목 ${item.id}: interpretations ${count}개`);
		if (item.confidence === 'high' && count > 0) warnings.push(`항목 ${item.id}: high인데 interpretations 있음`);
	}
	if (validation.unmatched_text.length > 0) warnings.push('unmatched_text가 비어 있지 않음');

	return { errors, warnings };
}
