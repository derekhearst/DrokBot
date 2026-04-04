import { redirect, type Handle } from '@sveltejs/kit'
import { isAuthenticated } from '$lib/auth/auth'

const PUBLIC_PATH_PREFIXES = ['/login', '/demo']

function isPublicPath(pathname: string) {
	if (pathname.startsWith('/_app') || pathname.startsWith('/favicon')) {
		return true
	}

	return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export const handle: Handle = async ({ event, resolve }) => {
	const authenticated = isAuthenticated(event.cookies)
	event.locals.authenticated = authenticated

	if (!authenticated && !isPublicPath(event.url.pathname)) {
		throw redirect(303, '/login')
	}

	if (authenticated && event.url.pathname === '/login') {
		throw redirect(303, '/')
	}

	return resolve(event)
}
