<svelte:head><title>Redirecting | AgentStudio</title></svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		void goto('/cost', { replaceState: true });
	});
</script>

<section class="p-4">
	<p class="text-sm text-base-content/70">Redirecting to cost dashboard...</p>
	<a class="link" href="/cost">Open cost dashboard</a>
</section>

