// Workers AI models for the analysis agent. To fall back to the free-plan
// model, set ANALYSIS_MODEL to MAIN_TURN_MODEL's value; nothing else changes.

// Runs the analysis in the harness. glm-5.3 needs Workers Paid (or AI Gateway
// credits); chosen from experiments/2026-11-06-models.
export const ANALYSIS_MODEL = '@cf/zai-org/glm-5.3';

// Answers the main turn ("완료"), which needs no judgment.
export const MAIN_TURN_MODEL = '@cf/zai-org/glm-4.7-flash';

export function cloudflareModel(id: string): string {
	return `cloudflare/${id}`;
}
