let open = $state(false)

export const dreamPanel = {
	get open() {
		return open
	},
	set open(v: boolean) {
		open = v
	},
	toggle() {
		open = !open
	},
}
