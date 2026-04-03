import { command, query } from '$app/server'
import { z } from 'zod'
import { execShell, getSandboxStatus as fetchSandboxStatus, readFile } from '$lib/server/tools/sandbox'

const execSchema = z.object({
	command: z.string().trim().min(1),
})

export const execCommand = command(execSchema, async (input) => {
	return execShell(input.command)
})

export const getFileContent = query(z.string().trim().min(1), async (path) => {
	return readFile(path)
})

export const getSandboxStatus = query(async () => {
	return fetchSandboxStatus()
})

export const getStatus = getSandboxStatus
