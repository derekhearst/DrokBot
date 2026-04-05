<script lang="ts">
	import ChatComposer from '$lib/components/chat/ChatComposer.svelte';

	let {
		busy = false,
		model = 'anthropic/claude-sonnet-4',
		onSubmit,
		onModelChange,
		onCancelGeneration,
		estimatedRemaining = 128000
	} = $props<{
		busy?: boolean;
		model?: string;
		onSubmit?: ((content: string) => Promise<void> | void) | undefined;
		onModelChange?: ((model: string) => Promise<void> | void) | undefined;
		onCancelGeneration?: (() => Promise<void> | void) | undefined;
		estimatedRemaining?: number;
	}>();

	let value = $state('');
	let recording = $state(false);
	let speechSupported = $state(false);
	let recognition: SpeechRecognition | null = null;
	let baseText = '';

	// Check browser support on mount
	$effect(() => {
		speechSupported = typeof window !== 'undefined' &&
			!!(window.SpeechRecognition || window.webkitSpeechRecognition);
	});

	function toggleRecording() {
		if (recording && recognition) {
			recognition.stop();
			return;
		}

		const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechAPI) return;

		baseText = value;
		recognition = new SpeechAPI();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = 'en-US';

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let final = '';
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					final += transcript;
				} else {
					interim += transcript;
				}
			}
			if (final) {
				baseText += (baseText && !baseText.endsWith(' ') ? ' ' : '') + final;
			}
			value = baseText + (interim ? (baseText && !baseText.endsWith(' ') ? ' ' : '') + interim : '');
		};

		recognition.onend = () => {
			recording = false;
			recognition = null;
		};

		recognition.onerror = (event) => {
			if (event.error !== 'aborted') {
				console.warn('Speech recognition error:', event.error);
			}
			recording = false;
			recognition = null;
		};

		recognition.start();
		recording = true;
	}

	async function handleSubmit(content: string) {
		if (!content.trim() || busy) return;
		if (recording && recognition) {
			recognition.stop();
		}
		const msg = content;
		value = '';
		baseText = '';
		await onSubmit?.(msg);
	}
</script>

<div class="space-y-2">
	<ChatComposer
		bind:value
		{busy}
		{model}
		{recording}
		{speechSupported}
		placeholder="Message DrokBot..."
		onSubmit={(content) => handleSubmit(content)}
		onModelChange={(id) => onModelChange?.(id)}
		onCancelGeneration={() => onCancelGeneration?.()}
		onAddFiles={() => {
			// File picker hook will be wired in a later pass.
		}}
		onMicClick={() => toggleRecording()}
	/>
</div>
