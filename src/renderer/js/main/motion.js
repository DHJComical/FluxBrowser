const { ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("../../../constants/config");
const { applyMotionPreference } = require("../shared/motion");

function applyAppMotionConfig(appConfig = {}) {
	applyMotionPreference(appConfig.animationsEnabled !== false);
}

function bindMotionPreferenceEvents() {
	ipcRenderer.on(IPC_CHANNELS.APP_CONFIG_UPDATED, (_event, appConfig = {}) => {
		applyAppMotionConfig(appConfig);
	});
}

async function hydrateMotionPreference() {
	try {
		const appConfig = await ipcRenderer.invoke("get-app-config");
		applyAppMotionConfig(appConfig);
	} catch (_error) {
		applyMotionPreference(true);
	}
}

module.exports = {
	bindMotionPreferenceEvents,
	hydrateMotionPreference,
};
