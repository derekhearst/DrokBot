<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getAgentChoices, runTaskNow } from '$lib/agents/agents.remote';
	import { getTask, reassignTask, setTaskStatus } from '$lib/tasks/tasks.remote';
	import { approveChanges, getChangedFiles, getTaskDiff, rejectChanges, requestRevision } from '$lib/tasks/review.remote';

	const taskId = $derived(page.params.id ?? '');

	type TaskDetail = Awaited<ReturnType<typeof getTask>>;
	type AgentChoice = Awaited<ReturnType<typeof getAgentChoices>>[number];
	type ChangedFile = Awaited<ReturnType<typeof getChangedFiles>>['files'][number];

	let detail = $state<TaskDetail | null>(null);
	let agents = $state<AgentChoice[]>([]);
	let diff = $state('');
	let files = $state<ChangedFile[]>([]);
	let revisionFeedback = $state('');
	let selectedAgent = $state('');
	let busy = $state(false);
	let reviewError = $state<string | null>(null);

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		if (!taskId) return;
		const [taskDetail, agentRows] = await Promise.all([getTask(taskId), getAgentChoices()]);
		detail = taskDetail;
		agents = agentRows;
		selectedAgent = taskDetail?.task.agentId ?? '';
		await loadReviewArtifacts();
	}

	async function loadReviewArtifacts() {
		if (!taskId) return;
		reviewError = null;
		try {
			const [diffData, filesData] = await Promise.all([getTaskDiff(taskId), getChangedFiles(taskId)]);
			diff = diffData.diff;
			files = filesData.files;
		} catch (cause) {
			reviewError = cause instanceof Error ? cause.message : 'No review data available';
			diff = '';
			files = [];
		}
	}

	async function runTask() {
		if (!taskId || busy) return;
		busy = true;
		try {
			await runTaskNow({ taskId });
			await refresh();
		} finally {
			busy = false;
		}
	}

	async function setStatus(status: 'pending' | 'running' | 'review' | 'completed' | 'failed') {
		if (!taskId) return;
		await setTaskStatus({ taskId, status });
		await refresh();
	}

	async function applyReassignment() {
		if (!taskId || !selectedAgent) return;
		await reassignTask({ taskId, agentId: selectedAgent });
		await refresh();
	}

	async function approve() {
		if (!taskId) return;
		await approveChanges(taskId);
		await refresh();
	}

	async function reject() {
		if (!taskId) return;
		await rejectChanges(taskId);
		await refresh();
	}

	async function askRevision() {
		if (!taskId || !revisionFeedback.trim()) return;
		await requestRevision({ taskId, feedback: revisionFeedback.trim() });
		revisionFeedback = '';
		await refresh();
	}
</script>

{#if !detail}
	<p class="text-sm text-base-content/70">Task not found.</p>
{:else}
	<section class="space-y-4">
		<a class="btn btn-sm btn-ghost" href="/tasks">Back to tasks</a>
		<header class="rounded-2xl border border-base-300 bg-base-100 p-4">
			<h1 class="text-2xl font-bold">{detail.task.title}</h1>
			<p class="mt-1 text-sm text-base-content/70">{detail.task.description}</p>
			<p class="mt-1 text-xs text-base-content/60">
				status {detail.task.status} | priority {detail.task.priority} | agent {detail.agent?.name ?? 'unknown'}
			</p>
			<div class="mt-3 flex flex-wrap gap-1">
				<button class="btn btn-xs" type="button" onclick={runTask} disabled={busy}>Run</button>
				<button class="btn btn-xs" type="button" onclick={() => setStatus('pending')}>Pending</button>
				<button class="btn btn-xs" type="button" onclick={() => setStatus('review')}>Review</button>
				<button class="btn btn-xs" type="button" onclick={() => setStatus('completed')}>Done</button>
				<button class="btn btn-xs btn-error btn-outline" type="button" onclick={() => setStatus('failed')}>Fail</button>
			</div>
		</header>

		<section class="rounded-2xl border border-base-300 bg-base-100 p-4">
			<h2 class="font-semibold">Assignment</h2>
			<div class="mt-2 flex flex-wrap gap-2">
				<select class="select select-bordered" bind:value={selectedAgent}>
					{#each agents as agent (agent.id)}
						<option value={agent.id}>{agent.name} ({agent.status})</option>
					{/each}
				</select>
				<button class="btn btn-outline" type="button" onclick={applyReassignment}>Reassign</button>
			</div>
		</section>

		<section class="grid gap-4 xl:grid-cols-2">
			<div class="rounded-2xl border border-base-300 bg-base-100 p-4">
				<h2 class="font-semibold">Changed Files</h2>
				{#if reviewError}
					<p class="mt-2 text-sm text-warning">{reviewError}</p>
				{:else if files.length === 0}
					<p class="mt-2 text-sm text-base-content/70">No files in review branch.</p>
				{:else}
					<ul class="mt-2 space-y-1 text-sm">
						{#each files as file (file.path)}
							<li class="rounded border border-base-300 bg-base-50 px-2 py-1">{file.status} {file.path}</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-2xl border border-base-300 bg-base-100 p-4">
				<h2 class="font-semibold">Review Actions</h2>
				<div class="mt-2 flex flex-wrap gap-2">
					<button class="btn btn-success btn-sm" type="button" onclick={approve}>Approve</button>
					<button class="btn btn-error btn-outline btn-sm" type="button" onclick={reject}>Reject</button>
				</div>
				<textarea
					class="textarea textarea-bordered mt-3 h-28 w-full"
					bind:value={revisionFeedback}
					placeholder="Request revision feedback"
				></textarea>
				<button class="btn btn-outline btn-sm mt-2" type="button" onclick={askRevision}>Request Revision</button>
			</div>
		</section>

		<section class="rounded-2xl border border-base-300 bg-base-100 p-4">
			<h2 class="font-semibold">Diff</h2>
			<pre class="mt-2 max-h-[420px] overflow-auto rounded border border-base-300 bg-base-50 p-3 text-xs">{diff || 'No diff available'}</pre>
		</section>
	</section>
{/if}
