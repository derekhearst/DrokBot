import { json, type RequestHandler } from '@sveltejs/kit'
import { resolvePlanDecision, type PlanDecision } from '$lib/tools/tools.server'

type PlanDecisionBody = {
	token?: string
	decision?: PlanDecision
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		const body = (await request.json()) as PlanDecisionBody
		if (!body.token || !body.decision) {
			console.warn('[chat/plan-decide] Invalid request payload', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				body,
			})
			return json({ error: 'token and decision are required' }, { status: 400 })
		}
		if (!['approve', 'deny', 'continue'].includes(body.decision)) {
			console.warn('[chat/plan-decide] Unsupported decision', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				decision: body.decision,
			})
			return json({ error: 'decision must be approve, deny, or continue' }, { status: 400 })
		}

		const resolved = resolvePlanDecision(body.token, body.decision)
		if (!resolved) {
			console.warn('[chat/plan-decide] Plan token not resolved', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				token: body.token,
				decision: body.decision,
			})
		}
		return json({ resolved })
	} catch (error) {
		console.error('[chat/plan-decide] Failed to resolve plan decision', {
			conversationId: params.id,
			userId: locals.user?.id ?? null,
			error: error instanceof Error ? error.message : String(error),
		})
		return json({ error: 'Failed to resolve plan decision' }, { status: 500 })
	}
}
