/**
 * In-memory approval queue for tool calls.
 * When tool approval mode is 'confirm', the stream server pauses before
 * executing a tool and waits for the client to POST approval/denial.
 */

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

type PendingApproval = {
	resolve: (approved: boolean) => void
	timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingApproval>()

/** Queue an approval request and return a Promise that resolves to true/false. */
export function requestApproval(token: string): Promise<boolean> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			if (pending.has(token)) {
				pending.delete(token)
				resolve(false)
			}
		}, APPROVAL_TIMEOUT_MS)

		pending.set(token, { resolve, timer })
	})
}

/** Resolve a pending approval. Returns false if the token was not found. */
export function resolveApproval(token: string, approved: boolean): boolean {
	const entry = pending.get(token)
	if (!entry) return false
	clearTimeout(entry.timer)
	pending.delete(token)
	entry.resolve(approved)
	return true
}
