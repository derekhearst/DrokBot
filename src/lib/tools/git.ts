import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

const execFileAsync = promisify(execFile)

async function runGit(args: string[], cwd = process.cwd()) {
	try {
		const { stdout } = await execFileAsync('git', args, { cwd })
		return stdout.trim()
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown git error'
		throw new Error(`git ${args.join(' ')} failed: ${message}`)
	}
}

export async function createBranch(taskId: string) {
	const branch = `task/${taskId}`
	await runGit(['checkout', '-b', branch])
	return branch
}

export async function commitChanges(branch: string, message: string, files?: string[]) {
	await runGit(['checkout', branch])
	if (files && files.length > 0) {
		await runGit(['add', ...files])
	} else {
		await runGit(['add', '.'])
	}
	await runGit(['commit', '-m', message])
	return { success: true }
}

export async function getDiff(branch: string) {
	try {
		return await runGit(['diff', `main...${branch}`])
	} catch {
		return runGit(['diff', branch])
	}
}

export async function getFileChanges(branch: string) {
	const raw = await runGit(['diff', '--name-status', `main...${branch}`])
	return raw
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [status, ...rest] = line.split(/\s+/)
			return {
				status,
				path: rest.join(' '),
			}
		})
}

export async function mergeBranch(branch: string) {
	await runGit(['checkout', 'main'])
	await runGit(['merge', '--no-ff', branch, '-m', `Merge ${branch}`])
	return { success: true }
}

export async function discardBranch(branch: string) {
	await runGit(['checkout', 'main'])
	await runGit(['branch', '-D', branch])
	return { success: true }
}
