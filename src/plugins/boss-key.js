module.exports = {
	name: "BossKey",
	shortcuts: {
		BossKey: (core) => {
			if (core.toggleBossKey) {
				core.toggleBossKey();
			} else {
				core.toggleVisibility();
			}
		},
	},
};
