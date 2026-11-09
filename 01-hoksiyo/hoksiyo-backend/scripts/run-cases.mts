// Runs test cases (docs/test-cases.md T01–T10, inputs in cases.json) against
// the dev server, one /api/analyze call each. Every call spends real Workers AI
// Neurons, so before each case it reads /api/usage and skips the case when
// used + reserved + W(n) would exceed the daily limit (the server would answer
// 429 anyway). It stops everything on a Workers AI 429, a billing error, or a
// harness timeout.
//
// Usage (in hoksiyo-backend/, with `npm run dev` running):
//   node --experimental-strip-types scripts/run-cases.mts experiments/<date>-<name>          # all 10
//   node --experimental-strip-types scripts/run-cases.mts experiments/<date>-<name> T10 T04  # some
// Then: node --experimental-strip-types scripts/summarize.mts experiments/<date>-<name>
//
// Cases run in the given order, or by default largest W first so the big
// reservations fit while the day's total is still low. W uses the same config
// as the server: readUsageConfig(process.env), i.e. the defaults in budget.ts
// (equal to wrangler.jsonc vars) unless you export overrides.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitSentences } from '../src/analysis/sentences.ts';
import { readUsageConfig, worstCase } from '../src/usage/budget.ts';

const BASE = process.env.HOKSIYO_URL ?? 'http://localhost:5173';
const DEFAULT_ORDER = ['T05', 'T01', 'T02', 'T10', 'T03', 'T06', 'T08', 'T09', 'T04', 'T07'];

const [outDir, ...ids] = process.argv.slice(2);
if (!outDir) {
	console.error('usage: run-cases.mts <out-dir> [T01 T02 ...]');
	process.exit(1);
}
const cases: Record<string, { feedback: string }> = JSON.parse(
	readFileSync(new URL('./cases.json', import.meta.url), 'utf8'),
);
const order = ids.length > 0 ? ids : DEFAULT_ORDER;
const config = readUsageConfig(process.env);
mkdirSync(outDir, { recursive: true });

async function usage() {
	return (await (await fetch(`${BASE}/api/usage`)).json()) as { used: number; reserved: number; limit: number };
}

const skipped: string[] = [];
for (const id of order) {
	const input = cases[id];
	if (!input) throw new Error(`unknown case ${id}`);
	const n = splitSentences(input.feedback).length;
	const w = worstCase(n, config);
	const before = await usage();
	const need = before.used + before.reserved + w;
	if (need > before.limit) {
		console.log(`${id} SKIP used=${before.used.toFixed(1)} W=${w} -> ${need.toFixed(1)} > ${before.limit}`);
		skipped.push(id);
		continue;
	}
	const startedAt = Date.now();
	const res = await fetch(`${BASE}/api/analyze`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
		signal: AbortSignal.timeout(300_000),
	});
	const body = (await res.json().catch(() => ({}))) as Record<string, any>;
	const record = {
		...body,
		_http: String(res.status),
		_elapsed_s: (Date.now() - startedAt) / 1000,
		_started_utc: new Date(startedAt).toISOString(),
		_used_before: before.used,
		_W: w,
	};
	writeFileSync(join(outDir, `${id}.json`), JSON.stringify(record, null, 2));

	const meta = body.meta ?? {};
	const detail = `${meta.outcome_detail ?? ''}${JSON.stringify(body.error ?? '')}`;
	const attempts = (meta.attempts ?? []).map((a: any) => a.errors.map((e: any) => e.cond));
	console.log(
		`${id} RUN http=${res.status} used_before=${before.used.toFixed(1)} W=${w} outcome=${meta.outcome} ` +
			`attempts=${JSON.stringify(attempts)} neurons=${body.usage?.neurons} dur=${meta.duration_ms}`,
	);
	if (res.status === 429 && body.error === 'daily_limit') {
		// Refused by the counter before any model call: costs nothing.
		skipped.push(id);
		continue;
	}
	if ([402, 403, 429].includes(res.status) || meta.outcome === 'timeout' || /429|402|quota|billing/.test(detail)) {
		console.log(`STOP (${detail.slice(0, 200)})`);
		break;
	}
}
console.log('END', JSON.stringify(await usage()), skipped.length > 0 ? `skipped: ${skipped.join(' ')}` : '');
