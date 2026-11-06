import type { LlmAnalysis } from './llm-schema.ts';
import type { AnalysisInput } from './validate.ts';

export type AnalysisItem = LlmAnalysis['items'][number] & { id: number };

export interface AnalysisResult {
	schema_version: string;
	project: { name: string };
	feedback_context: LlmAnalysis['feedback_context'];
	analysis: LlmAnalysis['analysis'] & {
		total_items: number;
		actionable_count: number;
		confirmation_count: number;
	};
	items: AnalysisItem[];
	validation: LlmAnalysis['validation'];
}

// Fills the fields code owns (docs/analysis-schema.md 6장 "구현 권장").
export function assemble(input: AnalysisInput, llm: LlmAnalysis): AnalysisResult {
	const items = llm.items.map((item, index) => ({ id: index + 1, ...item }));
	return {
		schema_version: '1.0',
		project: { name: input.project_line },
		feedback_context: llm.feedback_context,
		analysis: {
			input_type: llm.analysis.input_type,
			summary: llm.analysis.summary,
			total_items: items.length,
			actionable_count: items.filter((item) => item.status === 'actionable').length,
			confirmation_count: items.filter((item) => item.status === 'needs_confirmation').length,
		},
		items,
		validation: llm.validation,
	};
}
