<script lang="ts">
	import { browser, dev } from '$app/environment';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';
	import RecentChats from '$lib/components/ui/RecentChats.svelte';

	let { children } = $props();
	let mobileSidebarOpen = $state(false);

	const isLoginRoute = $derived(page.url.pathname.startsWith('/login'));
	const isChatRoute = $derived(page.url.pathname.startsWith('/chat'));

	function closeSidebar() {
		mobileSidebarOpen = false;
	}

	onMount(() => {
		if (!browser) return;

		const root = document.documentElement;
		let rafId = 0;
		let pulseTimer: ReturnType<typeof setTimeout> | null = null;

		const queuePointerUpdate = (x: number, y: number) => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				root.style.setProperty('--cursor-x', `${x}px`);
				root.style.setProperty('--cursor-y', `${y}px`);
				root.style.setProperty('--cursor-energy', '1');

				if (pulseTimer) clearTimeout(pulseTimer);
				pulseTimer = setTimeout(() => {
					root.style.setProperty('--cursor-energy', '0.35');
				}, 220);
			});
		};

		const handlePointerMove = (event: PointerEvent) => {
			queuePointerUpdate(event.clientX, event.clientY);
		};

		const handlePointerLeave = () => {
			root.style.setProperty('--cursor-energy', '0');
		};

		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('pointerleave', handlePointerLeave);

		if (dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker
				.getRegistrations()
				.then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
				.catch(() => {
					// Ignore cleanup failures in dev.
				});

			if ('caches' in window) {
				void caches
					.keys()
					.then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
					.catch(() => {
						// Ignore cache cleanup failures in dev.
					});
			}
		}

		if (!dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/service-worker.js').catch(() => {
				// Ignore registration failures in unsupported contexts.
			});
		}

		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerleave', handlePointerLeave);
			if (rafId) cancelAnimationFrame(rafId);
			if (pulseTimer) clearTimeout(pulseTimer);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isLoginRoute}
	{@render children()}
{:else}
	<div class="drawer lg:drawer-open">
		<input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={mobileSidebarOpen} />

		<div class="drawer-content relative flex h-screen flex-col overflow-hidden">
			<div class="mx-auto grid min-h-0 w-full max-w-400 flex-1 grid-rows-[1fr] gap-4 p-4 sm:p-6 {isChatRoute ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}">
				<main class="flex min-h-0 flex-col overflow-y-auto rounded-3xl border border-base-300 bg-base-100/85 p-4 shadow-sm sm:p-6">
					{@render children()}
				</main>

				{#if isChatRoute}
					<aside class="hidden overflow-y-auto rounded-3xl border border-base-300 bg-base-100/80 p-4 shadow-sm xl:block">
						<RecentChats />
					</aside>
				{/if}
			</div>
		</div>

		<div class="drawer-side z-30">
			<label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
			<Sidebar activePath={page.url.pathname} onNavigate={closeSidebar} />
		</div>
	</div>
{/if}
