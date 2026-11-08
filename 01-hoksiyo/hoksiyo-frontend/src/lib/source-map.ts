import type { AnalysisResult } from '../types.ts';
import { splitSentences } from './sentences.ts';

// Rebuilds sentence numbers for the result. The backend fills original_text,
// non_request_text and unmatched_text with the strings of splitSentences(feedback),
// so splitting the same feedback here and matching strings recovers the numbers.
// The backend sends strings, not numbers: when the same sentence appears more
// than once, every copy is linked the same way and marked as a duplicate.

export type SentenceRole = 'item' | 'non_request' | 'unlinked';

export interface SourceSentence {
  number: number; // 1-based, in source order
  text: string;
  itemIds: number[]; // items whose original_text holds this text
  role: SentenceRole;
  copies: number; // how many sentences share this text (1 = unique)
}

export interface SourceMap {
  sentences: SourceSentence[];
  // Sentence numbers per item id, in source order.
  sentencesByItem: Map<number, number[]>;
}

export function buildSourceMap(feedback: string, result: AnalysisResult): SourceMap {
  const texts = splitSentences(feedback);
  const numbersByText = new Map<string, number[]>();
  texts.forEach((text, index) => {
    numbersByText.set(text, [...(numbersByText.get(text) ?? []), index + 1]);
  });

  const itemIdsByText = new Map<string, number[]>();
  const sentencesByItem = new Map<number, number[]>();
  for (const item of result.items) {
    const numbers = new Set<number>();
    for (const text of item.original_text) {
      itemIdsByText.set(text, [...(itemIdsByText.get(text) ?? []), item.id]);
      for (const number of numbersByText.get(text) ?? []) numbers.add(number);
    }
    sentencesByItem.set(item.id, [...numbers].sort((a, b) => a - b));
  }
  const nonRequest = new Set(result.validation.non_request_text);

  // unmatched_text and sentences missing from every list both show as unlinked.
  const sentences = texts.map((text, index): SourceSentence => {
    const itemIds = [...new Set(itemIdsByText.get(text) ?? [])].sort((a, b) => a - b);
    const role: SentenceRole = itemIds.length > 0 ? 'item' : nonRequest.has(text) ? 'non_request' : 'unlinked';
    return { number: index + 1, text, itemIds, role, copies: numbersByText.get(text)?.length ?? 1 };
  });

  return { sentences, sentencesByItem };
}
