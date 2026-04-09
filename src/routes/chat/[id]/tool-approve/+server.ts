import { json, type RequestHandler } from '@sveltejs/kit'
import { resolveApproval } from '$lib/tools/tools.server'

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		const body = (await request.json()) as { token?: string; approved?: boolean }
		if (!body.token || typeof body.approved !== 'boolean') {
			console.warn('[chat/tool-approve] Invalid request payload', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				body,
			})
			return json({ error: 'token and approved are required' }, { status: 400 })
		}

		const resolved = resolveApproval(body.token, body.approved)
		if (!resolved) {
			console.warn('[chat/tool-approve] Approval token not resolved', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				token: body.token,
				approved: body.approved,
			})
		}
		return json({ resolved })
	} catch (error) {
		console.error('[chat/tool-approve] Failed to resolve tool approval', {
			conversationId: params.id,
			userId: locals.user?.id ?? null,
			error: error instanceof Error ? error.message : String(error),
		})
		return json({ error: 'Failed to resolve tool approval' }, { status: 500 })
	}
}
