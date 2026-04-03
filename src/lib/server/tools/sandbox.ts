import { SandboxClient } from '@agent-infra/sandbox'
import { env } from '$env/dynamic/private'

let sandboxClient: SandboxClient | null = null

function getClient() {
	if (!env.SANDBOX_URL) {
		throw new Error('SANDBOX_URL is not configured')
	}
	if (!sandboxClient) {
		sandboxClient = new SandboxClient({
			environment: env.SANDBOX_URL,
		})
	}
	return sandboxClient
}

function getErrorMessage(error: unknown) {
	if (error && typeof error === 'object') {
		if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
			return (error as { message: string }).message
		}
		return JSON.stringify(error)
	}
	return 'Sandbox request failed'
}

function assertOk<Success>(response: { ok: boolean; body?: Success; error?: unknown }) {
	if (!response.ok) {
		throw new Error(getErrorMessage(response.error))
	}
	return response.body as Success
}

export async function execShell(command: string) {
	const client = getClient()
	const response = await client.shell.execCommand({
		command,
		async_mode: false,
		timeout: 120,
	})
	const body = assertOk(response)
	const result = body.data
	return {
		success: body.success ?? true,
		command,
		status: result?.status ?? 'unknown',
		exitCode: result?.exit_code ?? null,
		output: result?.output ?? '',
		raw: result,
	}
}

export async function readFile(path: string) {
	const client = getClient()
	const response = await client.file.readFile({ file: path })
	const body = assertOk(response)
	return {
		path,
		content: body.data?.content ?? '',
	}
}

export async function writeFile(path: string, content: string) {
	const client = getClient()
	const response = await client.file.writeFile({ file: path, content })
	const body = assertOk(response)
	return {
		success: body.success ?? true,
		path,
		message: body.message ?? 'File written',
	}
}

export async function execCode(code: string, language: string) {
	const client = getClient()
	const response = await client.code.executeCode({
		language: language as never,
		code,
	})
	const body = assertOk(response)
	return {
		success: body.success ?? true,
		result: body.data,
	}
}

export async function browserNavigate(url: string) {
	const client = getClient()
	const response = await client.browserPage.navigate({ url })
	const body = assertOk(response)
	return {
		success: body.success ?? true,
		url,
	}
}

export async function browserScreenshot(url?: string) {
	const client = getClient()
	if (url) {
		await browserNavigate(url)
	}
	const response = await client.browserPage.screenshot({ full_page: true, format: 'png' })
	const body = assertOk(response)
	const buffer = Buffer.from(await body.arrayBuffer())
	return {
		mimeType: 'image/png',
		imageBase64: buffer.toString('base64'),
	}
}

export async function getSandboxStatus() {
	const client = getClient()
	const response = await client.shell.getSessionStats()
	const body = assertOk(response)
	return {
		success: body.success ?? true,
		message: body.message ?? 'Sandbox reachable',
		stats: body.data ?? null,
	}
}
