import type { LlmAnalysis } from './llm-schema.ts';
import { splitSentences } from './sentences.ts';
import type { AnalysisInput, Channel } from './validate.ts';

type LlmItem = LlmAnalysis['items'][number];

export type AnalysisItem = Omit<LlmItem, 'original_text'> & { id: number; original_text: string[] };

export interface AnalysisResult {
	schema_version: string;
	project: { name: string };
	feedback_context: { channel: Channel | 'unknown'; sender: string };
	analysis: LlmAnalysis['analysis'] & {
		total_items: number;
		actionable_count: number;
		confirmation_count: number;
	};
	items: AnalysisItem[];
	validation: Omit<LlmAnalysis['validation'], 'unmatched_text' | 'non_request_text'> & {
		unmatched_text: string[];
		non_request_text: string[];
	};
}

// The sender as given, or "unknown" when it was left out or blank.
export function senderOf(input: AnalysisInput): string {
	return input.sender?.trim() || 'unknown';
}

// Fills the fields code owns (docs/analysis-schema.md 6장 "구현 권장") and
// turns sentence numbers into the original sentences. Call validateRefs()
// first: out-of-range numbers are dropped here.
export function assemble(input: AnalysisInput, llm: LlmAnalysis): AnalysisResult {
	const sentences = splitSentences(input.feedback);
	// Deduplicated and sorted so original_text keeps source order.
	const toText = (refs: number[]) =>
		[...new Set(refs)]
			.sort((a, b) => a - b)
			.map((n) => sentences[n - 1])
			.filter((text): text is string => text !== undefined);
	const items = llm.items.map((item, index) => ({ id: index + 1, ...item, original_text: toText(item.original_text) }));
	return {
		schema_version: '1.0',
		project: { name: input.project_name },
		feedback_context: { channel: input.channel ?? 'unknown', sender: senderOf(input) },
		analysis: {
			input_type: llm.analysis.input_type,
			summary: llm.analysis.summary,
			total_items: items.length,
			actionable_count: items.filter((item) => item.status === 'actionable').length,
			confirmation_count: items.filter((item) => item.status === 'needs_confirmation').length,
		},
		items,
		validation: {
			...llm.validation,
			unmatched_text: toText(llm.validation.unmatched_text),
			non_request_text: toText(llm.validation.non_request_text),
		},
	};
}
