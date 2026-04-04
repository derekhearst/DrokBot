<script lang="ts">
	import ModelSelector from '$lib/components/ui/ModelSelector.svelte'

	let {
		value = $bindable(''),
		busy = false,
		model = 'anthropic/claude-sonnet-4',
		placeholder = 'Message DrokBot...',
		onSubmit,
		onModelChange,
		onCancelGeneration,
		onAddFiles,
		onMicClick,
		class: className = '',
	}: {
		value?: string
		busy?: boolean
		model?: string
		placeholder?: string
		onSubmit?: ((content: string) => Promise<void> | void) | undefined
		onModelChange?: ((modelId: string) => Promise<void> | void) | undefined
		onCancelGeneration?: (() => Promise<void> | void) | undefined
		onAddFiles?: (() => Promise<void> | void) | undefined
		onMicClick?: (() => Promise<void> | void) | undefined
		class?: string
	} = $props()

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		const trimmed = value.trim()
		if (!trimmed || busy) return
		await onSubmit?.(trimmed)
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			void submit(e as unknown as SubmitEvent)
		}
	}
</script>

<form onsubmit={submit} class="rounded-3xl border border-base-300 bg-base-100 p-3 shadow-sm {className}">
	<textarea
		class="w-full resize-none border-none bg-transparent px-2 py-1 text-base leading-6 outline-none focus:outline-none"
		rows="2"
		placeholder={placeholder}
		bind:value
		onkeydown={handleKeydown}
		disabled={busy}
	></textarea>

	<div class="mt-2 flex items-center justify-between gap-2 px-1">
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="btn btn-ghost btn-sm gap-2 rounded-full"
				disabled={busy}
				onclick={() => onAddFiles?.()}
			>
				<span class="text-lg leading-none">+</span>
				<span>Add files</span>
			</button>
		</div>

		<div class="flex items-center gap-1">
			<ModelSelector
				value={model}
				variant="inline"
				size="sm"
				onchange={(id: string) => onModelChange?.(id)}
			/>
			<button
				type="button"
				class="btn btn-ghost btn-sm btn-circle"
				aria-label="Voice input"
				title="Voice input"
				disabled={busy}
				onclick={() => onMicClick?.()}
			>
				🎤
			</button>
			{#if busy}
				<button
					type="button"
					class="btn btn-primary btn-sm btn-circle"
					aria-label="Stop generating"
					title="Stop generating"
					onclick={() => onCancelGeneration?.()}
				>
					<span class="h-3 w-3 rounded-sm bg-current"></span>
				</button>
			{:else}
				<button
					type="submit"
					class="btn btn-primary btn-sm btn-circle"
					aria-label="Send message"
					title="Send message"
					disabled={value.trim().length === 0}
				>
					<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M5 12h14"></path>
						<path d="m12 5 7 7-7 7"></path>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</form>
