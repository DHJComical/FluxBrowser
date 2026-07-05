const NativeLineWorkerClient = require("./NativeLineWorkerClient");

class NativeDirectionKeywordWorker {
	constructor() {
		this.client = new NativeLineWorkerClient({
			workerCommand: "direction-keyword-worker",
			requestIdPrefix: "direction-keywords",
			logPrefix: "DirectionKeywordDetector",
			workerLabel: "direction keyword worker",
		});
	}

	async analyze({ text }) {
		const response = await this.client.request({ text });
		if (!response) {
			return null;
		}

		return {
			matches: Array.isArray(response.matches) ? response.matches : [],
		};
	}
}

module.exports = NativeDirectionKeywordWorker;
