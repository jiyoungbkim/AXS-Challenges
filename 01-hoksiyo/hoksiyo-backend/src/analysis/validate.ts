import type { BaseIssue } from 'valibot';
import type { AnalysisResult } from './assemble.ts';
import { DEGREE_EXPRESSIONS, DEICTIC_EXPRESSIONS, findExpressions, quoteList, subjectParticle } from './expressions.ts';
import type { LlmAnalysis } from './llm-schema.ts';

// Checks the error conditions of docs/analysis-schema.md 6장. Conditions 6
// (enum values) and 7 (required fields) come from the Valibot parse through
// issuesToErrors(); 8, 12, and 16 are checked on sentence numbers by
// validateRefs(); 17 below. 13 holds by construction: only current-feedback sentences
// are numbered. 14 and 15 are reviewed by hand.

export type Channel = 'email' | 'messenger' | 'document';

export interface AnalysisInput {
	project_name: string;
	// Who passed the feedback on, and how. Filled into feedback_context by code.
	sender?: string;
	channel?: Channel;
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

// Runs before assemble(): an out-of-range number cannot be turned into a sentence.
export function validateRefs(llm: LlmAnalysis, sentenceCount: number): ValidationError[] {
	const errors: ValidationError[] = [];
	const refs = [
		...llm.items.flatMap((item) => item.original_text),
		...llm.validation.non_request_text,
		...llm.validation.unmatched_text,
	];
	for (const n of refs) {
		if (n < 1 || n > sentenceCount) {
			errors.push({ cond: 8, message: `문장 번호 ${n}은 범위(1–${sentenceCount}) 밖입니다.` });
		}
	}
	const used = new Set(refs);
	for (let n = 1; n <= sentenceCount; n++) {
		if (!used.has(n)) errors.push({ cond: 12, message: `문장 ${n}이 어디에도 기록되지 않았습니다.` });
	}
	const inItems = new Set(llm.items.flatMap((item) => item.original_text));
	for (const n of new Set(llm.validation.non_request_text)) {
		if (inItems.has(n)) {
			errors.push({ cond: 16, message: `문장 ${n}이 items의 original_text와 non_request_text에 동시에 있습니다.` });
		}
	}
	return errors;
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

	// 17: wording caps confidence, matched per quoted sentence (see expressions.ts).
	items.forEach((item) => {
		const quoted = item.original_text.join(' ');
		const degree = findExpressions(quoted, DEGREE_EXPRESSIONS);
		if (degree.length > 0 && item.confidence === 'high') {
			fail(17, `항목 ${item.id}의 원문에 ${quoteList(degree)}${subjectParticle(degree)} 있어 high로 판정할 수 없습니다. medium 또는 low로 다시 판정하세요.`);
		}
		const deictic = findExpressions(quoted, DEICTIC_EXPRESSIONS);
		if (deictic.length > 0 && item.confidence !== 'low') {
			fail(17, `항목 ${item.id}의 원문에 ${quoteList(deictic)}${subjectParticle(deictic)} 있어 수정 대상을 텍스트만으로 특정할 수 없습니다. low로 다시 판정하세요.`);
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

	const compactFeedback = input.feedback.replace(/\s+/g, '');
	for (const item of items) {
		const numbers = [item.request, ...item.interpretations].flatMap((text) => text.match(/\d+(?:[.,]\d+)*/g) ?? []);
		for (const number of new Set(numbers)) {
			if (!compactFeedback.includes(number)) warnings.push(`항목 ${item.id}: 원문에 없는 숫자 "${number}"`);
		}
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
