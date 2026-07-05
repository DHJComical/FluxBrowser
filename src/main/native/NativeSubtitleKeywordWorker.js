const NativeLineWorkerClient = require("./NativeLineWorkerClient");

class NativeSubtitleKeywordWorker {
	constructor() {
		this.client = new NativeLineWorkerClient({
			workerCommand: "subtitle-keyword-worker",
			requestIdPrefix: "subtitle-keywords",
			logPrefix: "SubtitleKeywordDetector",
			workerLabel: "subtitle keyword worker",
		});
	}

	async analyze({ text, rules, rulesSignature }) {
		const response = await this.client.request({
			text,
			rules,
			rulesSignature,
		});
		if (!response) {
			return null;
		}

		return {
			matches: Array.isArray(response.matches) ? response.matches : [],
		};
	}
}

module.exports = NativeSubtitleKeywordWorker;
