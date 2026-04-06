import { json, type RequestHandler } from '@sveltejs/kit'
import { resolveUserQuestions } from '$lib/tools/tools.server'

type AskUserBody = {
	token?: string
	answers?: Record<string, string>
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as AskUserBody
	if (!body.token || !body.answers || typeof body.answers !== 'object') {
		return json({ error: 'token and answers are required' }, { status: 400 })
	}

	const normalizedAnswers = Object.fromEntries(
		Object.entries(body.answers)
			.filter(([key, value]) => key.trim().length > 0 && typeof value === 'string')
			.map(([key, value]) => [key, value.trim()]),
	)

	if (Object.keys(normalizedAnswers).length === 0) {
		return json({ error: 'answers must include at least one value' }, { status: 400 })
	}

	const resolved = resolveUserQuestions(body.token, normalizedAnswers)
	return json({ resolved })
}
