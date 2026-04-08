<script lang="ts">
	import { browser } from '$app/environment';

	let { className = '' } = $props<{ className?: string }>();

	const THEMES = ['AgentStudio', 'AgentStudio-night'] as const;
	type ThemeName = (typeof THEMES)[number];

	let theme = $state<ThemeName>('AgentStudio');

	function applyTheme(next: ThemeName) {
		theme = next;
		if (!browser) return;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('AgentStudio-theme', next);
	}

	if (browser) {
		const saved = localStorage.getItem('AgentStudio-theme');
		if (saved === 'AgentStudio' || saved === 'AgentStudio-night') {
			theme = saved;
			document.documentElement.setAttribute('data-theme', saved);
		} else {
			const fromSystem: ThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'AgentStudio-night'
				: 'AgentStudio';
			theme = fromSystem;
			document.documentElement.setAttribute('data-theme', fromSystem);
			localStorage.setItem('AgentStudio-theme', fromSystem);
		}
	}

	function toggleTheme() {
		applyTheme(theme === 'AgentStudio' ? 'AgentStudio-night' : 'AgentStudio');
	}
</script>

<button class={`btn btn-sm btn-ghost ${className}`} type="button" onclick={toggleTheme} aria-label="Toggle theme">
	{#if theme === 'AgentStudio-night'}
		<span aria-hidden="true">Light</span>
	{:else}
		<span aria-hidden="true">Night</span>
	{/if}
</button>
