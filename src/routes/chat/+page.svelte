<script lang="ts">
	import { goto } from '$app/navigation';
	import { createConversation, deleteConversation, getConversations } from '$lib/chat/chat.remote';

	let title = $state('New conversation');
	let busy = $state(false);
	let conversations = $state<Awaited<ReturnType<typeof getConversations>>>([]);

	$effect(() => {
		void loadConversations();
	});

	async function loadConversations() {
		conversations = await getConversations();
	}

	async function handleCreate() {
		if (!title.trim() || busy) return;
		busy = true;
		try {
			const created = await createConversation({ title: title.trim() });
			await goto(`/chat/${created.id}`);
		} finally {
			busy = false;
		}
	}

	async function handleDelete(id: string) {
		await deleteConversation(id);
		await loadConversations();
	}
</script>

<section class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold">Conversations</h1>
			<p class="text-sm opacity-70">Pick up where you left off or start a new branch.</p>
		</div>
	</div>

	<div class="flex gap-2">
		<input class="input input-bordered w-full" bind:value={title} placeholder="Conversation title" />
		<button class="btn btn-primary" type="button" onclick={handleCreate} disabled={busy}>Create</button>
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		{#if conversations.length === 0}
			<p class="text-sm opacity-70">No conversations yet.</p>
		{:else}
			{#each conversations as conversation (conversation.id)}
				<article class="rounded-2xl border border-base-300 bg-base-100 p-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="font-semibold">{conversation.title}</h2>
							<p class="mt-1 line-clamp-2 text-sm opacity-70">{conversation.lastMessage ?? 'No messages yet'}</p>
						</div>
						<div class="flex gap-1">
							<a class="btn btn-xs btn-outline" href={`/chat/${conversation.id}`}>Open</a>
							<button class="btn btn-xs btn-ghost" type="button" onclick={() => handleDelete(conversation.id)}>
								Delete
							</button>
						</div>
					</div>
				</article>
			{/each}
		{/if}
	</div>
</section>
