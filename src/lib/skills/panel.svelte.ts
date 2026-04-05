let open = $state(false)

export const skillsPanel = {
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
