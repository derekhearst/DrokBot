<svelte:head><title>Chat | AgentStudio</title></svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		void goto('/', { replaceState: true });
	});
</script>

<section class="p-4">
	<p class="text-sm text-base-content/70">Redirecting to chat...</p>
	<a class="link" href="/">Open chat</a>
</section>
