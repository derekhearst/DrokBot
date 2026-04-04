<script lang="ts">
	import { tick } from 'svelte'
	import { getAvailableModels } from '$lib/llm/models.remote'

	interface Props {
		value?: string
		onchange?: (modelId: string) => void
		class?: string
		size?: 'xs' | 'sm' | 'default'
		variant?: 'default' | 'inline'
		showChevron?: boolean
		showBrowseBadge?: boolean
	}

	let {
		value = 'anthropic/claude-sonnet-4',
		onchange,
		class: className = '',
		size = 'default',
		variant = 'default',
		showChevron = true,
		showBrowseBadge = true,
	}: Props = $props()

	let models = $derived(await getAvailableModels())
	let search = $state('')
	let open = $state(false)
	let inputEl: HTMLInputElement | undefined = $state()

	$effect(() => {
		if (!open) return

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				open = false
				search = ''
			}
		}

		window.addEventListener('keydown', handleKeydown)
		void tick().then(() => inputEl?.focus())

		return () => {
			window.removeEventListener('keydown', handleKeydown)
		}
	})

	const sizeClass = $derived(
		size === 'xs' ? 'input-xs text-xs' : size === 'sm' ? 'input-sm text-sm' : ''
	)

	const isInline = $derived(variant === 'inline')

	const gridSizeClass = $derived(
		size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : ''
	)

	const filtered = $derived.by(() => {
		if (!search.trim()) return models
		const lower = search.toLowerCase()
		return models.filter(
			(m) =>
				m.id.toLowerCase().includes(lower) ||
				m.name.toLowerCase().includes(lower) ||
				(m.description ?? '').toLowerCase().includes(lower) ||
				(m.modality ?? '').toLowerCase().includes(lower) ||
				(m.instructType ?? '').toLowerCase().includes(lower) ||
				(m.inputModalities ?? []).join(' ').toLowerCase().includes(lower) ||
				(m.outputModalities ?? []).join(' ').toLowerCase().includes(lower)
		)
	})

	const selectedLabel = $derived.by(() => {
		const found = models.find((m) => m.id === value)
		return found ? found.name : value
	})

	function selectModel(id: string) {
		open = false
		search = ''
		onchange?.(id)
	}

	function formatPrice(value: string) {
		const num = Number(value)
		if (!Number.isFinite(num) || num === 0) return '$0'

		let formatted = num.toLocaleString(undefined, {
			useGrouping: false,
			minimumFractionDigits: 0,
			maximumFractionDigits: 8,
		})

		if (Number(formatted) === 0 && num > 0) {
			formatted = num.toFixed(12).replace(/\.?0+$/, '')
		}

		return `$${formatted}`
	}

	function formatTokens(tokens: number | null | undefined) {
		if (!tokens || tokens <= 0) return 'Unknown'
		if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
		return `${Math.round(tokens / 1000)}k`
	}

	function formatContextLabel(tokens: number | null | undefined) {
		const compact = formatTokens(tokens)
		if (compact === 'Unknown') return 'Context: Unknown'
		return `Context: ${compact} tokens`
	}
</script>

<div class="relative {className}">
	<button
		type="button"
		class="{isInline
			? `inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-base-content/85 hover:bg-base-200 ${size === 'xs' ? 'text-xs' : ''}`
			: `input input-bordered flex w-full items-center justify-between gap-2 text-left ${sizeClass}`
		}"
		onclick={() => {
			open = true
		}}
	>
		<span class="truncate">{selectedLabel}</span>
		{#if showChevron}
			<span class="opacity-70">▾</span>
		{/if}
		{#if !isInline && showBrowseBadge}
			<span class="badge badge-ghost badge-xs">Browse</span>
		{/if}
	</button>

	{#if open}
		<div class="fixed inset-0 z-1000">
			<button
				type="button"
				class="absolute inset-0 bg-black/65"
				aria-label="Close model selector"
				onclick={() => {
					open = false
					search = ''
				}}
			></button>

			<div
				class="relative mx-auto mt-[6vh] flex h-[82vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
				style="background-color: Canvas; color: CanvasText; opacity: 1"
			>
				<div class="flex items-center gap-3 border-b border-base-300 px-4 py-3" style="background-color: Canvas">
					<input
						bind:this={inputEl}
						class="input input-bordered w-full"
						type="text"
						placeholder="Search model name, provider, modalities, or description..."
						bind:value={search}
					/>
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => {
							open = false
							search = ''
						}}
					>
						Close
					</button>
				</div>

				<div class="px-4 pt-3 text-sm text-base-content/65">
					{filtered.length} model{filtered.length === 1 ? '' : 's'}
				</div>

				<div
					class="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3 {gridSizeClass}"
					style="background-color: Canvas"
				>
					{#if filtered.length === 0}
						<div class="col-span-full rounded-xl border border-dashed border-base-300 p-6 text-center text-base-content/55">
							No models found for that search.
						</div>
					{:else}
						{#each filtered as m (m.id)}
							<button
								type="button"
								class="flex h-full flex-col rounded-xl border border-base-300 bg-base-100 p-4 text-left transition hover:border-primary/50 hover:bg-base-200/60 {m.id === value ? 'ring-2 ring-primary/40 border-primary/60' : ''}"
								style="background-color: color-mix(in srgb, Canvas 92%, CanvasText 8%); opacity: 1"
								onclick={() => selectModel(m.id)}
							>
								<div>
									<div class="mb-3 flex items-start justify-between gap-3">
										<div class="min-w-0">
											<div class="truncate font-semibold">{m.name}</div>
											<div class="truncate text-xs opacity-60">{m.id}</div>
										</div>
										<span
											class="badge badge-outline badge-sm whitespace-nowrap"
											title="Model context window"
										>
											{formatContextLabel(m.contextLength)}
										</span>
									</div>

									<div class="mb-3 whitespace-normal wrap-break-word text-xs opacity-80">
										{m.description || 'No description available.'}
									</div>
								</div>

								<div class="mt-auto space-y-3 pt-2">
									<div class="flex flex-wrap gap-1 text-xs">
										{#if m.modality}
											<span class="badge badge-ghost badge-xs">{m.modality}</span>
										{/if}
										{#if m.instructType}
											<span class="badge badge-ghost badge-xs">{m.instructType}</span>
										{/if}
										{#if m.isModerated !== null && m.isModerated !== undefined}
											<span class="badge badge-ghost badge-xs">{m.isModerated ? 'moderated' : 'unmoderated'}</span>
										{/if}
									</div>

									<div class="grid grid-cols-2 gap-2 text-xs opacity-75">
										<div>
											<div class="opacity-50">Prompt</div>
											<div class="font-mono">{formatPrice(m.promptPrice)}</div>
										</div>
										<div>
											<div class="opacity-50">Completion</div>
											<div class="font-mono">{formatPrice(m.completionPrice)}</div>
										</div>
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
