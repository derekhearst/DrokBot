import { json, type RequestHandler } from '@sveltejs/kit'
import { resolveUserQuestions } from '$lib/tools/tools.server'

type AskUserBody = {
	token?: string
	answers?: Record<string, string>
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		const body = (await request.json()) as AskUserBody
		if (!body.token || !body.answers || typeof body.answers !== 'object') {
			console.warn('[chat/ask-user] Invalid request payload', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				body,
			})
			return json({ error: 'token and answers are required' }, { status: 400 })
		}

		const normalizedAnswers = Object.fromEntries(
			Object.entries(body.answers)
				.filter(([key, value]) => key.trim().length > 0 && typeof value === 'string')
				.map(([key, value]) => [key, value.trim()]),
		)

		if (Object.keys(normalizedAnswers).length === 0) {
			console.warn('[chat/ask-user] Empty normalized answers', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				token: body.token,
			})
			return json({ error: 'answers must include at least one value' }, { status: 400 })
		}

		const resolved = resolveUserQuestions(body.token, normalizedAnswers)
		if (!resolved) {
			console.warn('[chat/ask-user] ask_user token not resolved', {
				conversationId: params.id,
				userId: locals.user?.id ?? null,
				token: body.token,
				answerCount: Object.keys(normalizedAnswers).length,
			})
		}
		return json({ resolved })
	} catch (error) {
		console.error('[chat/ask-user] Failed to resolve ask_user answers', {
			conversationId: params.id,
			userId: locals.user?.id ?? null,
			error: error instanceof Error ? error.message : String(error),
		})
		return json({ error: 'Failed to resolve ask_user answers' }, { status: 500 })
	}
}
