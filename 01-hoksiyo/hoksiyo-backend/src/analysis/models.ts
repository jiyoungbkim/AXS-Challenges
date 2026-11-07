// Workers AI models for the analysis agent. To fall back to the free-plan
// model, set ANALYSIS_MODEL to MAIN_TURN_MODEL's value; nothing else changes.

// Runs the analysis in the harness. glm-5.3 needs Workers Paid (or AI Gateway
// credits); chosen from experiments/2026-11-06-models.
export const ANALYSIS_MODEL = '@cf/zai-org/glm-5.3';

// Reasoning effort for the harness (Flue sends it as reasoning_effort). low cut
// glm-5.3's output tokens by 82-91% against the default medium with the same
// key judgments (experiments/2026-11-07-thinking-low).
export type Thinking = 'low' | 'medium' | 'high';
export const ANALYSIS_THINKING: Thinking = 'low';

// Answers the main turn ("완료"), which needs no judgment.
export const MAIN_TURN_MODEL = '@cf/zai-org/glm-4.7-flash';

export function cloudflareModel(id: string): string {
	return `cloudflare/${id}`;
}

// Neurons per million tokens (developers.cloudflare.com/workers-ai/platform/pricing,
// 2026-11-06) and the fastest output rate seen in experiments/, used to estimate
// a run that ended without usage. glm-5.3's cached-input rate comes from pi-ai's
// catalog ($0.26/M) and matched the Cloudflare dashboard on 2026-11-07.
export interface ModelRates {
	inputPerM: number;
	cachedPerM: number;
	outputPerM: number;
	maxOutputTokensPerSecond: number;
}

export const MODEL_RATES: Record<string, ModelRates> = {
	'@cf/zai-org/glm-5.3': { inputPerM: 127_273, cachedPerM: 23_636, outputPerM: 400_000, maxOutputTokensPerSecond: 205 },
	'@cf/zai-org/glm-4.7-flash': { inputPerM: 5_500, cachedPerM: 5_500, outputPerM: 36_400, maxOutputTokensPerSecond: 60 },
};

export function ratesFor(model: string): ModelRates {
	const rates = MODEL_RATES[model];
	if (!rates) throw new Error(`[hoksiyo] No Neurons rates for model "${model}". Add it to MODEL_RATES.`);
	return rates;
}
