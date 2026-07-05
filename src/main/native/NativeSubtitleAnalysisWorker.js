const NativeLineWorkerClient = require("./NativeLineWorkerClient");

class NativeSubtitleAnalysisWorker {
	constructor() {
		this.client = new NativeLineWorkerClient({
			workerCommand: "subtitle-analysis-worker",
			requestIdPrefix: "subtitle-analysis",
			logPrefix: "LiveSubtitleAnalysisCoordinator",
			workerLabel: "subtitle analysis worker",
		});
	}

	async analyze({ text, rules, rulesSignature, includeDirectionMatches }) {
		const response = await this.client.request({
			text,
			rules,
			rulesSignature,
			includeDirectionMatches,
		});
		if (!response) {
			return null;
		}

		return {
			keywordMatches: Array.isArray(response.keywordMatches)
				? response.keywordMatches
				: [],
			directionMatches: Array.isArray(response.directionMatches)
				? response.directionMatches
				: [],
		};
	}
}

module.exports = NativeSubtitleAnalysisWorker;
