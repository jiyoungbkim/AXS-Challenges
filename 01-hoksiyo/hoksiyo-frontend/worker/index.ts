import { analyze } from './analyze.ts';
import { hasSession, startSession } from './session.ts';

// The only API routes. Every analysis goes through /api/analyze, which needs
// a session before it reaches the backend's usage counter.
export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);
		const route = `${request.method} ${pathname}`;

		if (route === 'GET /api/session') return Response.json({ ok: await hasSession(request, env) });
		if (route === 'POST /api/session') return startSession(request, env);
		if (route === 'POST /api/analyze') {
			if (!(await hasSession(request, env))) return Response.json({ error: 'access_required' }, { status: 401 });
			return analyze(request, env);
		}
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
