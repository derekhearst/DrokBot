<script lang="ts">
	type AskUserOption = {
		label: string
		description?: string
		recommended?: boolean
	}

	type AskUserQuestion = {
		header: string
		question: string
		options: AskUserOption[]
		allowFreeformInput?: boolean
	}

	let {
		question,
		value = '',
		onChange,
	} = $props<{
		question: AskUserQuestion
		value?: string
		onChange?: ((value: string) => void) | undefined
	}>()

	const optionLabels = $derived(new Set((question.options ?? []).map((option: AskUserOption) => option.label)))
	const isCustomValue = $derived(value.trim().length > 0 && !optionLabels.has(value))

	function selectOption(label: string) {
		onChange?.(label)
	}

	function updateCustomAnswer(next: string) {
		onChange?.(next)
	}

	function handleCustomFocus() {
		if (!isCustomValue) {
			onChange?.('')
		}
	}
</script>

<div class="space-y-2">
	{#if question.options.length > 0}
		<div class="space-y-2">
			{#each question.options as option (option.label)}
				<button
					type="button"
					class={`w-full rounded-xl border px-3 py-2 text-left transition-colors duration-150 ${
						value === option.label
							? 'border-primary/60 bg-primary/15 text-base-content ring-1 ring-primary/25'
							: 'border-base-300/70 bg-base-200/35 text-base-content/95 hover:border-base-300 hover:bg-base-200/55'
					}`}
					onclick={() => selectOption(option.label)}
				>
					<span class="block text-sm leading-tight">{option.label}</span>
					{#if option.description}
						<span class="mt-1 block text-[11px] leading-tight opacity-70">{option.description}</span>
					{/if}
					{#if option.recommended}
						<span class="badge badge-xs mt-1 w-fit">Recommended</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if question.allowFreeformInput ?? true}
		<div class="mt-1">
			<textarea
				class="min-h-16 w-full resize-y rounded-xl border border-base-300/70 bg-base-100 px-3 py-2 text-sm text-base-content transition-colors duration-150 placeholder:text-base-content/45 focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
				placeholder="Or write your own answer"
				value={isCustomValue ? value : ''}
				onfocus={handleCustomFocus}
				oninput={(event) => updateCustomAnswer((event.currentTarget as HTMLTextAreaElement).value)}
			></textarea>
		</div>
	{/if}
</div>
