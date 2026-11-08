// Tester access. The code lives only in the ACCESS_CODE secret; a correct code
// gets an HttpOnly cookie `<expiry>.<HMAC(ACCESS_CODE, expiry)>`, so changing
// the code also ends every session. No session, no call to the backend.

const COOKIE = 'hoksiyo_session';
const MAX_AGE_SECONDS = 8 * 24 * 60 * 60;

const encoder = new TextEncoder();

async function sha256(text: string): Promise<ArrayBuffer> {
	return crypto.subtle.digest('SHA-256', encoder.encode(text));
}

// Hashing first gives both sides the same length, as timingSafeEqual requires.
async function sameText(a: string, b: string): Promise<boolean> {
	return crypto.subtle.timingSafeEqual(await sha256(a), await sha256(b));
}

async function sign(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	]);
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
	return btoa(String.fromCharCode(...mac))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function readCookie(request: Request): string | undefined {
	for (const part of (request.headers.get('cookie') ?? '').split(';')) {
		const [name, ...rest] = part.trim().split('=');
		if (name === COOKIE) return rest.join('=');
	}
	return undefined;
}

function cookieHeader(request: Request, value: string, maxAge: number): string {
	// Secure only over https: Safari drops Secure cookies on http://localhost.
	const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
	return `${COOKIE}=${value}; Max-Age=${maxAge}; Path=/api; HttpOnly; SameSite=Strict${secure}`;
}

export async function hasSession(request: Request, env: Env): Promise<boolean> {
	const code = env.ACCESS_CODE;
	const token = readCookie(request);
	if (!code || !token) return false;
	const [expiry, mac] = token.split('.');
	if (!expiry || !mac || !(Number(expiry) > Date.now() / 1000)) return false;
	return sameText(mac, await sign(code, expiry));
}

// POST /api/session {code}: sets the cookie on a match.
export async function startSession(request: Request, env: Env): Promise<Response> {
	let code: unknown;
	try {
		code = ((await request.json()) as { code?: unknown }).code;
	} catch {
		code = undefined;
	}
	// An unset secret denies everyone rather than letting an empty code in.
	if (!env.ACCESS_CODE || typeof code !== 'string' || !(await sameText(code.trim(), env.ACCESS_CODE))) {
		return Response.json({ error: 'access_denied' }, { status: 401 });
	}
	const expiry = String(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
	const value = `${expiry}.${await sign(env.ACCESS_CODE, expiry)}`;
	return Response.json({ ok: true }, { headers: { 'set-cookie': cookieHeader(request, value, MAX_AGE_SECONDS) } });
}
