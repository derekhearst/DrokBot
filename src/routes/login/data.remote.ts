import { fail } from '@sveltejs/kit'
import { form, getRequestEvent } from '$app/server'
import { isValidPassword, setSessionCookie } from '$lib/server/auth'

export const loginAction = form(async () => {
	const event = getRequestEvent()
	const formData = await event.request.formData()
	const passwordValue = formData.get('password')
	const password = typeof passwordValue === 'string' ? passwordValue : ''

	if (!password || !isValidPassword(password)) {
		return fail(400, { error: 'Invalid password' })
	}

	setSessionCookie(event.cookies)
	return { success: true }
})
