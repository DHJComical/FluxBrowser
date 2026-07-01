const { autoUpdater } = require("electron-updater");
const {
	createUpdaterLogger,
	createUpdaterDebugLog,
} = require("./updater/updaterLogger");
const {
	registerUpdaterEvents,
	registerUpdaterIpc,
} = require("./updater/updaterEvents");

class Updater {
	constructor(core) {
		this.core = core;
		autoUpdater.logger = createUpdaterLogger();
		this.setup();
	}

	setup() {
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = true;

		const debugLog = createUpdaterDebugLog();
		registerUpdaterEvents(autoUpdater, this.core, debugLog);
		registerUpdaterIpc(autoUpdater);
	}
}

module.exports = Updater;
