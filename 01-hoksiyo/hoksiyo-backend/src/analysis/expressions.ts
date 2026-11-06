// 출처: docs/analysis-rules.md 4장 "판정 시 주의". 규칙 변경 시 함께 수정
// (docs/analysis-schema.md 6장 조건 17과 같은 목록).

// Degree or sensory wording: an item quoting one of these cannot be high.
export const DEGREE_EXPRESSIONS = ['조금', '좀', '느낌', '분위기', '뭔가'] as const;

// Deictic wording: an item quoting one of these must be low.
export const DEICTIC_EXPRESSIONS = ['여기', '이 부분', '저거', '이거'] as const;

const PATTERNS: Record<string, RegExp> = {
	// Also matches "이부분".
	'이 부분': /이\s*부분/,
	// Skips the "~이거나" ending ("크기이거나").
	이거: /이거(?!나)/,
};

export function findExpressions(text: string, list: readonly string[]): string[] {
	return list.filter((expression) => (PATTERNS[expression] ?? new RegExp(expression)).test(text));
}

export function quoteList(list: readonly string[]): string {
	return list.map((expression) => `'${expression}'`).join(', ');
}

// Subject particle for the last quoted word: '조금'이 / '분위기'가.
export function subjectParticle(list: readonly string[]): string {
	const code = (list.at(-1) ?? '').charCodeAt((list.at(-1) ?? '').length - 1) - 0xac00;
	return code >= 0 && code <= 11171 && code % 28 !== 0 ? '이' : '가';
}
