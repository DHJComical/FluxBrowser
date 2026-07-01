const configManager = require("../ConfigManager");

function getKeyFromConfig(core, actionId) {
	if (core && core.getKey) {
		return core.getKey(actionId);
	}
	const keyConfig = configManager.getKeyConfig();
	return keyConfig[actionId];
}

function isActionRegistered(registeredShortcuts, actionId) {
	for (const registeredActionId of registeredShortcuts.values()) {
		if (registeredActionId === actionId) {
			return true;
		}
	}
	return false;
}

function getRegisteredShortcutsMap(registeredShortcuts) {
	const result = {};
	for (const [key, actionId] of registeredShortcuts.entries()) {
		result[actionId] = key;
	}
	return result;
}

module.exports = {
	getKeyFromConfig,
	isActionRegistered,
	getRegisteredShortcutsMap,
};
