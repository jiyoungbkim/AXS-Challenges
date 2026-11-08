// Shapes of /api/analyze. The result follows docs/analysis-schema.md (built by
// hoksiyo-backend/src/analysis/assemble.ts); the envelope follows
// hoksiyo-backend/src/app.ts. Shared by the app and the Worker.

export type Channel = 'email' | 'messenger' | 'document';
export type InputType = 'revision_feedback' | 'no_revision_request' | 'out_of_scope';
export type RequesterStatus = 'identified' | 'unconfirmed';
export type Confidence = 'high' | 'medium' | 'low';
export type ItemStatus = 'actionable' | 'needs_confirmation';
export type PriorFeedbackReference = 'matched' | 'not_found' | 'not_provided' | 'not_applicable';

// What the app sends. The Worker forwards only these fields.
export interface AnalyzeRequest {
	project_name: string;
	sender?: string;
	channel?: Channel;
	feedback: string;
	prior_feedback?: string;
}

export interface AnalysisItem {
	id: number;
	original_text: string[];
	request: string;
	requester: string;
	requester_status: RequesterStatus;
	interpretations: string[];
	confidence: Confidence;
	confidence_reason: string;
	status: ItemStatus;
	prior_feedback_reference: PriorFeedbackReference;
	questions: string[];
}

export interface AnalysisResult {
	schema_version: string;
	project: { name: string };
	feedback_context: { channel: Channel | 'unknown'; sender: string };
	analysis: {
		input_type: InputType;
		summary: string;
		total_items: number;
		actionable_count: number;
		confirmation_count: number;
	};
	items: AnalysisItem[];
	validation: {
		unmatched_text: string[];
		non_request_text: string[];
		missing_information: string[];
		notes: string[];
	};
}

export type Outcome = 'finished' | 'no_finish' | 'give_up' | 'aborted' | 'timeout' | 'error';

export interface ValidationError {
	cond: number | 'schema' | 'parse';
	message: string;
}

// The fields of the backend's analysis_meta the app reads.
export interface AnalysisMeta {
	outcome: Outcome;
	outcome_detail?: string;
	final_errors: ValidationError[];
	warnings: string[];
	duration_ms: number;
}

export interface UsageReport {
	neurons: number;
	basis: string;
	daily_used: number;
	daily_limit: number;
}

// 200: analysis is null unless meta.outcome is 'finished'.
export interface AnalyzeRunBody {
	analysis: AnalysisResult | null;
	meta: AnalysisMeta;
	usage: UsageReport;
}

// 504: the submission itself failed (240s durability timeout).
export interface AnalyzeSubmissionFailedBody {
	analysis: null;
	meta: null;
	error: { outcome: string; message: string; submissionId?: string };
	usage: UsageReport;
}

// Errors from the backend before any model call (no Neurons spent).
export type BackendErrorBody =
	| { error: 'invalid_input'; issues: string[] }
	| { error: 'feedback_too_long'; message: string; max: number; length: number }
	| { error: 'too_many_sentences'; message: string; max: number; sentences: number }
	| { error: 'daily_limit'; message: string; used: number; reserved: number; limit: number; resets_at: string };

// Errors the frontend Worker answers itself.
export type WorkerErrorBody =
	| { error: 'access_denied' } // wrong code at /api/session
	| { error: 'access_required' } // no or expired session at /api/analyze
	| { error: 'backend_unreachable' } // the service binding call threw
	| { error: 'backend_error'; status: number }; // the backend answered without JSON

export type ErrorBody = BackendErrorBody | WorkerErrorBody;
export type ErrorCode = ErrorBody['error'];

export interface SessionStatus {
	ok: boolean;
}
