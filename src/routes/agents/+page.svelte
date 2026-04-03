<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listAgents,
		runSchedulerTickCommand,
		schedulerSnapshot,
		updateAgentStatus
	} from '$lib/agents/agents.remote';

	type AgentRow = Awaited<ReturnType<typeof listAgents>>[number];
	type Snapshot = Awaited<ReturnType<typeof schedulerSnapshot>>;

	let agents = $state<AgentRow[]>([]);
	let snapshot = $state<Snapshot | null>(null);
	let busy = $state(false);

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		const [agentRows, scheduler] = await Promise.all([listAgents(), schedulerSnapshot()]);
		agents = agentRows;
		snapshot = scheduler;
	}

	async function setStatus(agentId: string, status: 'active' | 'paused' | 'idle') {
		await updateAgentStatus({ agentId, status });
		await refresh();
	}

	async function runTick() {
		if (busy) return;
		busy = true;
		try {
			await runSchedulerTickCommand({ maxConcurrent: 2 });
			await refresh();
		} finally {
			busy = false;
		}
	}
</script>

<section class="space-y-4">
	<header class="rounded-2xl border border-base-300 bg-base-100 p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h1 class="text-3xl font-bold">Agents</h1>
				<p class="text-sm text-base-content/70">Manage lifecycle and scheduling for autonomous workers.</p>
			</div>
			<div class="flex gap-2">
				<button class="btn btn-outline" type="button" onclick={runTick} disabled={busy}>Run Scheduler Tick</button>
				<a class="btn btn-primary" href="/agents/new">New Agent</a>
			</div>
		</div>
	</header>

	{#if snapshot}
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Open runs: {snapshot.openRuns}</div>
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Pending: {snapshot.queue.pending}</div>
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Running: {snapshot.queue.running}</div>
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Review: {snapshot.queue.review}</div>
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Completed: {snapshot.queue.completed}</div>
			<div class="rounded-xl border border-base-300 bg-base-100 p-3 text-sm">Failed: {snapshot.queue.failed}</div>
		</div>
	{/if}

	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#if agents.length === 0}
			<p class="text-sm text-base-content/70">No agents yet.</p>
		{:else}
			{#each agents as agent (agent.id)}
				<article class="rounded-2xl border border-base-300 bg-base-100 p-4">
					<div class="flex items-start justify-between gap-2">
						<div>
							<h2 class="font-semibold">{agent.name}</h2>
							<p class="text-xs text-base-content/60">{agent.role}</p>
						</div>
						<span class="badge">{agent.status}</span>
					</div>
					<p class="mt-3 text-xs text-base-content/70">
						pending {agent.pendingCount} | running {agent.runningCount} | review {agent.reviewCount}
					</p>
					<div class="mt-3 flex flex-wrap gap-1">
						<a class="btn btn-xs btn-outline" href={`/agents/${agent.id}`}>Open</a>
						<button class="btn btn-xs" type="button" onclick={() => setStatus(agent.id, 'active')}>Activate</button>
						<button class="btn btn-xs" type="button" onclick={() => setStatus(agent.id, 'idle')}>Idle</button>
						<button class="btn btn-xs btn-warning" type="button" onclick={() => setStatus(agent.id, 'paused')}>Pause</button>
					</div>
				</article>
			{/each}
		{/if}
	</div>
</section>
