<script lang="ts">
	import { getConversations } from '$lib/chat';
	import ContentPanel from '$lib/components/ui/ContentPanel.svelte';

	type Conversation = Awaited<ReturnType<typeof getConversations>>[number];
	type GroupMode = 'date' | 'category';

	let conversations = $state<Conversation[]>([]);
	let groupMode = $state<GroupMode>('date');
	let search = $state('');

	$effect(() => {
		void loadConversations();
	});

	async function loadConversations() {
		conversations = await getConversations();
	}

	function relativeTime(date: Date | string) {
		const diff = Date.now() - new Date(date).getTime();
		const minutes = Math.floor(diff / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function formatDayLabel(date: Date) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const target = new Date(date);
		target.setHours(0, 0, 0, 0);

		const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
		if (dayDiff === 0) return 'Today';
		if (dayDiff === 1) return 'Yesterday';

		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}

	function dayKey(date: Date | string) {
		const d = new Date(date);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return conversations;
		return conversations.filter(
			(c) =>
				c.title.toLowerCase().includes(q) ||
				(c.lastMessage && c.lastMessage.toLowerCase().includes(q))
		);
	});

	const grouped = $derived.by(() => {
		const sorted = [...filtered].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);

		if (groupMode === 'category') {
			const categoryMap = new Map<string, Conversation[]>();
			for (const c of sorted) {
				const label = c.category?.trim() || 'Uncategorized';
				const bucket = categoryMap.get(label);
				if (bucket) {
					bucket.push(c);
				} else {
					categoryMap.set(label, [c]);
				}
			}

			const labels = [...categoryMap.keys()].sort((a, b) => {
				if (a === 'Uncategorized') return 1;
				if (b === 'Uncategorized') return -1;
				return a.localeCompare(b);
			});

			return labels.map((label) => ({
				label,
				items: categoryMap.get(label) ?? []
			}));
		}

		const dateMap = new Map<string, { label: string; timestamp: number; items: Conversation[] }>();
		for (const c of sorted) {
			const updated = new Date(c.updatedAt);
			const key = dayKey(updated);
			const existing = dateMap.get(key);
			if (existing) {
				existing.items.push(c);
			} else {
				const dayStart = new Date(updated);
				dayStart.setHours(0, 0, 0, 0);
				dateMap.set(key, {
					label: formatDayLabel(updated),
					timestamp: dayStart.getTime(),
					items: [c]
				});
			}
		}

		return [...dateMap.values()]
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((group) => ({
				label: group.label,
				items: group.items
			}));
	});
</script>

<ContentPanel bare compact flush>
	{#snippet header()}
		<div class="w-full space-y-2 pb-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 class="text-xl font-bold sm:text-3xl">Chats</h1>
					<p class="text-xs text-base-content/70 sm:text-sm">Recent conversations</p>
				</div>
				<label class="flex items-center gap-2 text-xs text-base-content/60">
					<span>Group</span>
					<select class="select select-bordered select-xs" bind:value={groupMode} aria-label="Group chats">
						<option value="date">Date</option>
						<option value="category">Category</option>
					</select>
				</label>
			</div>
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search chats…"
				bind:value={search}
				aria-label="Search chats"
			/>
		</div>
	{/snippet}

	<div class="mt-3 space-y-4">
		{#if conversations.length === 0}
			<p class="py-6 text-center text-sm text-base-content/40">No conversations yet</p>
		{:else}
			{#each grouped as group (group.label)}
				<div>
					<p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-base-content/40">{group.label}</p>
					<div class="space-y-1">
						{#each group.items as conversation (conversation.id)}
							<a
								href={`/chat/${conversation.id}`}
								class="block rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-base-200"
							>
								<span class="line-clamp-1 font-medium">{conversation.title}</span>
								<span class="mt-0.5 line-clamp-1 text-xs text-base-content/50">
									{conversation.lastMessage ?? 'No messages yet'}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</ContentPanel>
