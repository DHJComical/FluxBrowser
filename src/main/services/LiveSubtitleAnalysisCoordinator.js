const NativeSubtitleAnalysisWorker = require("../native/NativeSubtitleAnalysisWorker");
const { createRuleSignature } = require("./subtitleKeywordAnalyzer");
const { normalizeSubtitleText } = require("./directionKeywordAnalyzer");

class LiveSubtitleAnalysisCoordinator {
	constructor({ subtitleKeywordDetector, directionKeywordDetector }) {
		this.subtitleKeywordDetector = subtitleKeywordDetector;
		this.directionKeywordDetector = directionKeywordDetector;
		this.nativeWorker = new NativeSubtitleAnalysisWorker();
	}

	async handleSnapshot(snapshot = {}) {
		const keywordRules = this.subtitleKeywordDetector.getActiveRules();
		const includeDirectionMatches = this.directionKeywordDetector.isEnabled();
		const text = normalizeSubtitleText(snapshot);
		const hasKeywordRules = keywordRules.length > 0;

		if (snapshot?.found !== true || !text) {
			await this.handleWithExistingDetectors(snapshot);
			return;
		}

		if (!hasKeywordRules && !includeDirectionMatches) {
			await this.handleWithExistingDetectors(snapshot);
			return;
		}

		try {
			const nativeResult = await this.nativeWorker.analyze({
				text,
				rules: keywordRules,
				rulesSignature: createRuleSignature(keywordRules),
				includeDirectionMatches,
			});
			if (nativeResult) {
				const analyzedSnapshot = {
					...snapshot,
					text,
				};
				await Promise.allSettled([
					this.subtitleKeywordDetector.handleAnalyzedMatches(
						analyzedSnapshot,
						nativeResult.keywordMatches,
						hasKeywordRules ? "rust" : "",
					),
					this.directionKeywordDetector.handleAnalyzedMatches(
						analyzedSnapshot,
						nativeResult.directionMatches,
						includeDirectionMatches ? "rust" : "",
					),
				]);
				return;
			}
		} catch (_error) {
			// Fall through to the existing detector pipelines.
		}

		await this.handleWithExistingDetectors(snapshot);
	}

	async handleWithExistingDetectors(snapshot = {}) {
		await Promise.allSettled([
			this.subtitleKeywordDetector.handleSnapshot(snapshot),
			this.directionKeywordDetector.handleSnapshot(snapshot),
		]);
	}
}

module.exports = LiveSubtitleAnalysisCoordinator;
