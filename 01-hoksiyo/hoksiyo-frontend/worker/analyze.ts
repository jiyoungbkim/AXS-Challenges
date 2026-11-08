import type { AnalyzeRequest, Channel } from '../src/types.ts';
import { mockBackend } from './mock.ts';

// POST /api/analyze, after the session check: rebuilds the body from the
// allowed fields, forwards it to hoksiyo-backend over the BACKEND binding (or
// to the mock), and relays the answer.

const CHANNELS = new Set<string>(['email', 'messenger', 'document']);

// Fields removed from every backend answer (the backend drops them on 11/9).
const STRIPPED_FIELDS = ['reply_text', 'reply_metadata'];

function invalid(issue: string): Response {
	return Response.json({ error: 'invalid_input', issues: [issue] }, { status: 400 });
}

// Only these fields reach the backend, whatever the client sends; blank
// optional fields are left out so the backend fills "unknown".
function toBackendInput(raw: unknown): AnalyzeRequest | string {
	if (typeof raw !== 'object' || raw === null) return '요청 본문이 JSON 객체가 아닙니다.';
	const body = raw as Record<string, unknown>;
	if (typeof body.project_name !== 'string' || !body.project_name.trim()) return 'project_name이 필요합니다.';
	if (typeof body.feedback !== 'string' || !body.feedback.trim()) return 'feedback이 필요합니다.';
	const input: AnalyzeRequest = { project_name: body.project_name, feedback: body.feedback };
	if (typeof body.sender === 'string' && body.sender.trim()) input.sender = body.sender;
	if (typeof body.channel === 'string' && CHANNELS.has(body.channel)) input.channel = body.channel as Channel;
	if (typeof body.prior_feedback === 'string' && body.prior_feedback.trim()) input.prior_feedback = body.prior_feedback;
	return input;
}

async function relay(upstream: Response): Promise<Response> {
	let body: unknown;
	try {
		body = await upstream.json();
	} catch {
		body = undefined;
	}
	if (typeof body !== 'object' || body === null) {
		return Response.json({ error: 'backend_error', status: upstream.status }, { status: 502 });
	}
	const clean: Record<string, unknown> = { ...body };
	for (const field of STRIPPED_FIELDS) delete clean[field];
	return Response.json(clean, { status: upstream.status });
}

export async function analyze(request: Request, env: Env): Promise<Response> {
	if (!request.headers.get('content-type')?.includes('application/json')) {
		return invalid('content-type은 application/json이어야 합니다.');
	}
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return invalid('요청 본문을 JSON으로 읽지 못했습니다.');
	}
	const input = toBackendInput(raw);
	if (typeof input === 'string') return invalid(input);

	// 11/9 백엔드 정리와 함께 삭제: the backend still requires `mode` until its
	// cleanup. 'C' (runResultMode) is the mode the cleanup keeps.
	const backendBody = { ...input, mode: 'C' };

	let upstream: Response;
	try {
		upstream =
			env.MOCK_ANALYZE === '1'
				? await mockBackend(input)
				: await env.BACKEND.fetch('https://hoksiyo-backend/api/analyze', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(backendBody),
					});
	} catch {
		return Response.json({ error: 'backend_unreachable' }, { status: 502 });
	}
	return relay(upstream);
}
