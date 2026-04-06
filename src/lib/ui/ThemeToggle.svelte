<script lang="ts">
	import { browser } from '$app/environment';

	let { className = '' } = $props<{ className?: string }>();

	const THEMES = ['AGENTSTUDIO', 'AGENTSTUDIO-night'] as const;
	type ThemeName = (typeof THEMES)[number];

	let theme = $state<ThemeName>('AGENTSTUDIO');

	function applyTheme(next: ThemeName) {
		theme = next;
		if (!browser) return;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('AGENTSTUDIO-theme', next);
	}

	if (browser) {
		const saved = localStorage.getItem('AGENTSTUDIO-theme');
		if (saved === 'AGENTSTUDIO' || saved === 'AGENTSTUDIO-night') {
			theme = saved;
			document.documentElement.setAttribute('data-theme', saved);
		} else {
			const fromSystem: ThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'AGENTSTUDIO-night'
				: 'AGENTSTUDIO';
			theme = fromSystem;
			document.documentElement.setAttribute('data-theme', fromSystem);
			localStorage.setItem('AGENTSTUDIO-theme', fromSystem);
		}
	}

	function toggleTheme() {
		applyTheme(theme === 'AGENTSTUDIO' ? 'AGENTSTUDIO-night' : 'AGENTSTUDIO');
	}
</script>

<button class={`btn btn-sm btn-ghost ${className}`} type="button" onclick={toggleTheme} aria-label="Toggle theme">
	{#if theme === 'AGENTSTUDIO-night'}
		<span aria-hidden="true">Light</span>
	{:else}
		<span aria-hidden="true">Night</span>
	{/if}
</button>
