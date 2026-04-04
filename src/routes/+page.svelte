<svelte:head><title>Chat | DrokBot</title></svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { createConversation } from '$lib/chat';
	import ChatComposer from '$lib/components/chat/ChatComposer.svelte';

	let busy = $state(false);
	let prompt = $state('');
	let model = $state('anthropic/claude-sonnet-4');

	function getGreeting() {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		return 'Good evening';
	}

	const greeting = getGreeting();

	async function handleNewChat(initialPrompt?: string) {
		if (busy) return;
		busy = true;
		try {
			const trimmedPrompt = initialPrompt?.trim() ?? '';
			const title = trimmedPrompt.slice(0, 80) || 'New conversation';
			const created = await createConversation({ title, model });
			if (trimmedPrompt) {
				await goto(`/chat/${created.id}?prompt=${encodeURIComponent(trimmedPrompt)}`);
			} else {
				await goto(`/chat/${created.id}`);
			}
		} finally {
			busy = false;
		}
	}

	const suggestions = [
		{ label: 'Write code', icon: '✦', prompt: 'Help me write ' },
		{ label: 'Debug an issue', icon: '⚡', prompt: 'Help me debug ' },
		{ label: 'Explain a concept', icon: '📖', prompt: 'Explain ' },
		{ label: 'Brainstorm ideas', icon: '💡', prompt: 'Brainstorm ideas for ' }
	];
</script>

<div class="flex flex-1 flex-col items-center justify-center">
	<div class="w-full max-w-2xl space-y-8 text-center">
		<!-- Greeting -->
		<div>
			<h1 class="text-4xl font-semibold tracking-tight text-base-content/90">{greeting}, Derek</h1>
			<p class="mt-2 text-lg text-base-content/50">How can I help you today?</p>
		</div>

		<!-- Input Area -->
		<ChatComposer
			bind:value={prompt}
			{busy}
			{model}
			placeholder="Start a new conversation..."
			onSubmit={(content) => handleNewChat(content)}
			onModelChange={(id) => {
				model = id;
			}}
			onAddFiles={() => {
				// File picker hook will be wired in a later pass.
			}}
			onMicClick={() => {
				// Voice capture hook will be wired in a later pass.
			}}
		/>

		<!-- Suggestion Chips -->
		<div class="flex flex-wrap justify-center gap-2">
			{#each suggestions as s (s.label)}
				<button
					type="button"
					class="btn btn-sm btn-outline rounded-full"
					disabled={busy}
					onclick={() => { prompt = s.prompt; }}
				>
					<span>{s.icon}</span>
					{s.label}
				</button>
			{/each}
		</div>
	</div>
</div>
