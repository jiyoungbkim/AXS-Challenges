// Copy of hoksiyo-backend/src/analysis/sentences.ts (only this header differs).
// The backend's split decides what original_text holds, so keep the two in
// sync (indentation differs too): diff -w hoksiyo-backend/src/analysis/sentences.ts hoksiyo-frontend/src/lib/sentences.ts
//
// Sentence boundaries follow docs/analysis-schema.md 3.4: split on `.`, `?`, `!`
// and newlines. Commas, ellipses (`..`, `...`, `…`), emoticons, and a period
// between two digits (`1.5배`) are not boundaries.

const TERMINATORS = new Set(['.', '?', '!']);

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function isBoundary(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === '?' || ch === '!') return true;
  if (ch !== '.') return false;
  const prev = text[i - 1];
  const next = text[i + 1];
  if (prev === '.' || next === '.') return false;
  if (isDigit(prev) && isDigit(next)) return false;
  return true;
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) sentences.push(trimmed);
    current = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') {
      flush();
      continue;
    }
    current += ch;
    if (!isBoundary(text, i)) continue;
    // A run like `?!` or `!!` closes one sentence.
    while (i + 1 < text.length && TERMINATORS.has(text[i + 1])) {
      current += text[++i];
    }
    flush();
  }
  flush();
  return sentences;
}
