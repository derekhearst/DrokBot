/**
 * In-memory registry of currently active agent streams.
 * Entries older than STALE_MS are filtered out automatically.
 */

interface StreamEntry {
	agentId: string
	delta: string
	updatedAt: number
}

const STALE_MS = 30_000

const _streams = new Map<string, StreamEntry>()

export function setStreamingState(conversationId: string, agentId: string, delta: string) {
	_streams.set(conversationId, { agentId, delta, updatedAt: Date.now() })
}

export function clearStreamingState(conversationId: string) {
	_streams.delete(conversationId)
}

export function getActiveAgentStreams(): Array<{ conversationId: string; agentId: string; delta: string }> {
	const now = Date.now()
	const result: Array<{ conversationId: string; agentId: string; delta: string }> = []
	for (const [conversationId, entry] of _streams) {
		if (now - entry.updatedAt < STALE_MS) {
			result.push({ conversationId, agentId: entry.agentId, delta: entry.delta })
		} else {
			_streams.delete(conversationId)
		}
	}
	return result
}
