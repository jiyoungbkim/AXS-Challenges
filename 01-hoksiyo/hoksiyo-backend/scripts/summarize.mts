// Prints what run-cases.mts saved, per case: outcome, finish attempts with the
// failed conditions, feedback_context, each item's judgment, and Neurons
// recomputed from the recorded usage. Compare against docs/test-cases.md; the
// "검증 포인트" that need reading (wording, questions) are judged by hand.
//
// Usage (in hoksiyo-backend/):
//   node --experimental-strip-types scripts/summarize.mts experiments/<date>-<name>

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYSIS_MODEL, MAIN_TURN_MODEL } from '../src/analysis/models.ts';
import { recordedNeurons } from '../src/usage/budget.ts';

const dir = process.argv[2];
if (!dir) {
	console.error('usage: summarize.mts <dir>');
	process.exit(1);
}

let total = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
	const d = JSON.parse(readFileSync(join(dir, file), 'utf8'));
	const meta = d.meta ?? {};
	const a = d.analysis;
	const u = meta.usage;
	const main = d.reply_metadata?.response_usage;
	const neurons =
		(u ? recordedNeurons(meta.model ?? ANALYSIS_MODEL, u) : 0) + (main ? recordedNeurons(MAIN_TURN_MODEL, main) : 0);
	total += neurons;
	console.log(
		`=== ${file.replace('.json', '')} http=${d._http} outcome=${meta.outcome} thinking=${meta.thinking} ` +
			`dur=${meta.duration_ms}ms neurons=${neurons.toFixed(0)}` +
			(u ? ` (in/cache/out ${u.input}/${u.cacheRead}/${u.output})` : ''),
	);
	for (const attempt of meta.attempts ?? []) {
		for (const e of attempt.errors) console.log(`  attempt ${attempt.n}: [조건 ${e.cond}] ${e.message}`);
	}
	if (meta.final_errors?.length) console.log('  final_errors', JSON.stringify(meta.final_errors));
	if (meta.warnings?.length) console.log('  warnings', JSON.stringify(meta.warnings));
	if (!a) {
		console.log('  (no analysis)', JSON.stringify(d.error ?? meta.outcome_detail ?? ''));
		continue;
	}
	console.log(`  context ${a.feedback_context.channel}/${a.feedback_context.sender}  input_type ${a.analysis.input_type}`);
	console.log(`  summary ${a.analysis.summary}`);
	for (const it of a.items) {
		console.log(
			`  #${it.id} ${it.confidence}·${it.status}·${it.requester}(${it.requester_status})·${it.prior_feedback_reference}` +
				` 원문 ${it.original_text.length}문장 해석안 ${it.interpretations.length} 질문 ${it.questions.length}`,
		);
		console.log(`     request: ${it.request}`);
		console.log(`     reason:  ${it.confidence_reason}`);
		for (const q of it.questions) console.log(`     Q: ${q}`);
	}
	const v = a.validation;
	console.log(`  non_request ${JSON.stringify(v.non_request_text)}  unmatched ${JSON.stringify(v.unmatched_text)}`);
	if (v.missing_information.length) console.log(`  missing ${JSON.stringify(v.missing_information)}`);
	if (v.notes.length) console.log(`  notes ${JSON.stringify(v.notes)}`);
}
console.log(`TOTAL neurons ${total.toFixed(1)}`);
