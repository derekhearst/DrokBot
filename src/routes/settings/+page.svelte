<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		getPushPublicKey,
		listNotificationFeed,
		listSubscriptions,
		markNotification,
		sendTestNotification,
		subscribePush,
		unsubscribePush
	} from '$lib/notifications/notifications.remote';

	type NotificationRow = Awaited<ReturnType<typeof listNotificationFeed>>[number];
	type SubscriptionRow = Awaited<ReturnType<typeof listSubscriptions>>[number];

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	};

	let installPromptEvent = $state<BeforeInstallPromptEvent | null>(null);
	let notifications = $state<NotificationRow[]>([]);
	let subscriptions = $state<SubscriptionRow[]>([]);
	let pushEnabled = $state(false);
	let busy = $state(false);
	let installAvailable = $derived(installPromptEvent !== null);
	let testTitle = $state('Task needs review');
	let testBody = $state('A delegated task is waiting for your approval.');
	let testUrl = $state('/tasks');
	let statusMessage = $state('');

	onMount(() => {
		void refresh();
		if (!browser) return;

		const onInstallPrompt = (event: Event) => {
			event.preventDefault();
			installPromptEvent = event as BeforeInstallPromptEvent;
		};

		window.addEventListener('beforeinstallprompt', onInstallPrompt);
		return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
	});

	async function refresh() {
		const [feed, subs] = await Promise.all([listNotificationFeed(), listSubscriptions()]);
		notifications = feed;
		subscriptions = subs;
		pushEnabled = subs.length > 0;
	}

	function base64ToUint8Array(value: string) {
		const padding = '='.repeat((4 - (value.length % 4)) % 4);
		const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(base64);
		const output = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i += 1) {
			output[i] = raw.charCodeAt(i);
		}
		return output;
	}

	async function enablePush() {
		if (!browser || !('serviceWorker' in navigator) || !('PushManager' in window)) {
			statusMessage = 'Push is not supported in this browser.';
			return;
		}
		busy = true;
		statusMessage = '';
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				statusMessage = 'Notification permission was not granted.';
				return;
			}

			const registration = await navigator.serviceWorker.ready;
			const { publicKey } = await getPushPublicKey();
			const current = await registration.pushManager.getSubscription();
			const subscription =
				current ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64ToUint8Array(publicKey)
				}));

			const json = subscription.toJSON();
			if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
				statusMessage = 'Subscription payload is incomplete.';
				return;
			}

			await subscribePush({
				endpoint: json.endpoint,
				keys: {
					p256dh: json.keys.p256dh,
					auth: json.keys.auth
				},
				deviceLabel: navigator.userAgent.slice(0, 110)
			});

			statusMessage = 'Push notifications enabled.';
			await refresh();
		} finally {
			busy = false;
		}
	}

	async function disablePush() {
		if (!browser || !('serviceWorker' in navigator)) return;
		busy = true;
		statusMessage = '';
		try {
			const registration = await navigator.serviceWorker.ready;
			const existing = await registration.pushManager.getSubscription();
			if (existing) {
				const endpoint = existing.endpoint;
				await existing.unsubscribe();
				await unsubscribePush({ endpoint });
			}
			statusMessage = 'Push notifications disabled.';
			await refresh();
		} finally {
			busy = false;
		}
	}

	async function sendTest() {
		if (busy) return;
		busy = true;
		statusMessage = '';
		try {
			await sendTestNotification({
				title: testTitle,
				body: testBody,
				url: testUrl,
				tag: 'phase7-test'
			});
			statusMessage = 'Test notification sent.';
			await refresh();
		} finally {
			busy = false;
		}
	}

	async function markRead(notificationId: string, read: boolean) {
		await markNotification({ notificationId, read });
		await refresh();
	}

	async function promptInstall() {
		if (!installPromptEvent) return;
		await installPromptEvent.prompt();
		await installPromptEvent.userChoice;
		installPromptEvent = null;
	}
</script>

<section class="space-y-5">
	<header class="rounded-2xl border border-base-300 bg-base-100 p-4">
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="text-sm text-base-content/70">
			Phase 7 controls for PWA install and push notifications.
		</p>
	</header>

	<section class="grid gap-4 lg:grid-cols-2">
		<article class="rounded-2xl border border-base-300 bg-base-100 p-4">
			<h2 class="text-lg font-semibold">App Install</h2>
			<p class="mt-1 text-sm text-base-content/70">Install DrokBot as a standalone app for desktop and mobile.</p>
			<button class="btn btn-primary mt-3" type="button" onclick={promptInstall} disabled={!installAvailable}>
				Install App
			</button>
		</article>

		<article class="rounded-2xl border border-base-300 bg-base-100 p-4">
			<h2 class="text-lg font-semibold">Push Notifications</h2>
			<p class="mt-1 text-sm text-base-content/70">
				Current status: {pushEnabled ? 'enabled' : 'disabled'} ({subscriptions.length} subscriptions)
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<button class="btn btn-success" type="button" onclick={enablePush} disabled={busy}>Enable Push</button>
				<button class="btn btn-outline" type="button" onclick={disablePush} disabled={busy}>Disable Push</button>
			</div>
			{#if statusMessage}
				<p class="mt-2 text-sm text-base-content/70">{statusMessage}</p>
			{/if}
		</article>
	</section>

	<section class="rounded-2xl border border-base-300 bg-base-100 p-4">
		<h2 class="text-lg font-semibold">Send Test Notification</h2>
		<div class="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
			<input class="input input-bordered" bind:value={testTitle} placeholder="Title" />
			<input class="input input-bordered" bind:value={testBody} placeholder="Body" />
			<input class="input input-bordered" bind:value={testUrl} placeholder="URL" />
			<button class="btn btn-secondary" type="button" onclick={sendTest} disabled={busy}>Send</button>
		</div>
	</section>

	<section class="rounded-2xl border border-base-300 bg-base-100 p-4">
		<h2 class="text-lg font-semibold">Notification Feed</h2>
		{#if notifications.length === 0}
			<p class="mt-2 text-sm text-base-content/70">No notifications recorded yet.</p>
		{:else}
			<div class="mt-2 space-y-2">
				{#each notifications as item (item.id)}
					<article class="rounded-xl border border-base-300 bg-base-50 p-3">
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="font-medium">{item.title}</p>
								<p class="text-sm text-base-content/70">{item.body}</p>
								<p class="text-xs text-base-content/60">{new Date(item.createdAt).toLocaleString()}</p>
							</div>
							<div class="flex gap-1">
								{#if item.read}
									<button class="btn btn-xs" type="button" onclick={() => markRead(item.id, false)}>Unread</button>
								{:else}
									<button class="btn btn-xs" type="button" onclick={() => markRead(item.id, true)}>Read</button>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</section>
