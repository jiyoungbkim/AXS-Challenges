import { nextResetIso, utcDate } from './budget.ts';

// The daily Neurons ledger: one Durable Object instance (idFromName('global'))
// serializes every reserve/commit, so concurrent analyses cannot overspend.
// Rows are keyed by UTC date, so a new day starts from zero.

// Minimal shapes of the Durable Object SQLite API this file uses, so the
// backend does not need the full workers-types package.
interface SqlCursor {
	toArray(): Record<string, unknown>[];
}

export interface SqlStorage {
	exec(query: string, ...bindings: unknown[]): SqlCursor;
}

interface DurableObjectStateLike {
	storage: { sql: SqlStorage };
}

// A reservation never committed (the Worker died mid-analysis) is assumed to
// have spent its full amount once it is this old. Longer than the 240s
// submission timeout plus the main turn.
const STALE_RESERVATION_MS = 10 * 60 * 1000;
const KEEP_DAYS = 7;

export interface LedgerStatus {
	date: string;
	used: number;
	reserved: number;
	limit: number;
	resets_at: string;
}

export type ReserveResult = (LedgerStatus & { ok: true; ticket: string }) | (LedgerStatus & { ok: false });

export class UsageLedger {
	private readonly sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.sql = sql;
		sql.exec('CREATE TABLE IF NOT EXISTS daily (date TEXT PRIMARY KEY, used REAL NOT NULL)');
		sql.exec(
			'CREATE TABLE IF NOT EXISTS reservations (ticket TEXT PRIMARY KEY, date TEXT NOT NULL, amount REAL NOT NULL, created_at INTEGER NOT NULL)',
		);
	}

	private addUsed(date: string, amount: number): void {
		this.sql.exec(
			'INSERT INTO daily (date, used) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET used = used + excluded.used',
			date,
			amount,
		);
	}

	private sweep(nowMs: number): void {
		const stale = this.sql
			.exec('SELECT ticket, date, amount FROM reservations WHERE created_at <= ?', nowMs - STALE_RESERVATION_MS)
			.toArray();
		for (const row of stale) {
			this.addUsed(String(row.date), Number(row.amount));
			this.sql.exec('DELETE FROM reservations WHERE ticket = ?', row.ticket);
		}
		const cutoff = utcDate(nowMs - KEEP_DAYS * 24 * 60 * 60 * 1000);
		this.sql.exec('DELETE FROM daily WHERE date < ?', cutoff);
	}

	status(limit: number, nowMs: number): LedgerStatus {
		this.sweep(nowMs);
		const date = utcDate(nowMs);
		const used = Number(this.sql.exec('SELECT used FROM daily WHERE date = ?', date).toArray()[0]?.used ?? 0);
		const reserved = Number(
			this.sql.exec('SELECT COALESCE(SUM(amount), 0) AS s FROM reservations WHERE date = ?', date).toArray()[0]?.s ?? 0,
		);
		return { date, used, reserved, limit, resets_at: nextResetIso(nowMs) };
	}

	reserve(amount: number, limit: number, nowMs: number, ticket: string): ReserveResult {
		const status = this.status(limit, nowMs);
		if (status.used + status.reserved + amount > limit) return { ...status, ok: false };
		this.sql.exec(
			'INSERT INTO reservations (ticket, date, amount, created_at) VALUES (?, ?, ?, ?)',
			ticket,
			status.date,
			amount,
			nowMs,
		);
		return { ...status, reserved: status.reserved + amount, ok: true, ticket };
	}

	// Charges the actual amount to the day the reservation was made. A ticket that
	// was already swept as stale is ignored; its reserved amount stands.
	commit(ticket: string, amount: number): boolean {
		const row = this.sql.exec('SELECT date FROM reservations WHERE ticket = ?', ticket).toArray()[0];
		if (!row) return false;
		this.addUsed(String(row.date), amount);
		this.sql.exec('DELETE FROM reservations WHERE ticket = ?', ticket);
		return true;
	}
}

// Fetch-based Durable Object. Exported from src/cloudflare.ts and bound as
// USAGE_COUNTER in wrangler.jsonc.
export class UsageCounter {
	private readonly ledger: UsageLedger;

	constructor(ctx: DurableObjectStateLike, _env: unknown) {
		this.ledger = new UsageLedger(ctx.storage.sql);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const now = Date.now();
		const body = request.method === 'POST' ? ((await request.json()) as Record<string, unknown>) : {};
		switch (url.pathname) {
			case '/status':
				return Response.json(this.ledger.status(Number(url.searchParams.get('limit')), now));
			case '/reserve':
				return Response.json(this.ledger.reserve(Number(body.amount), Number(body.limit), now, crypto.randomUUID()));
			case '/commit':
				return Response.json({ ok: this.ledger.commit(String(body.ticket), Number(body.amount)) });
			default:
				return new Response('not found', { status: 404 });
		}
	}
}

// Client side: the Worker's view of the USAGE_COUNTER binding.
interface DurableObjectStubLike {
	fetch(input: string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
	idFromName(name: string): unknown;
	get(id: unknown): DurableObjectStubLike;
}

export function usageCounter(namespace: DurableObjectNamespaceLike) {
	const stub = namespace.get(namespace.idFromName('global'));
	const post = async <T>(path: string, body: unknown): Promise<T> =>
		(await stub.fetch(`https://usage-counter${path}`, { method: 'POST', body: JSON.stringify(body) })).json() as Promise<T>;
	return {
		status: async (limit: number) =>
			(await stub.fetch(`https://usage-counter/status?limit=${limit}`)).json() as Promise<LedgerStatus>,
		reserve: (amount: number, limit: number) => post<ReserveResult>('/reserve', { amount, limit }),
		commit: (ticket: string, amount: number) => post<{ ok: boolean }>('/commit', { ticket, amount }),
	};
}
