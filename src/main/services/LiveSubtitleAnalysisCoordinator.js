const NativeSubtitleAnalysisWorker = require("../native/NativeSubtitleAnalysisWorker");
const { createRuleSignature } = require("./subtitleKeywordAnalyzer");
const { normalizeSubtitleText } = require("./directionKeywordAnalyzer");

class LiveSubtitleAnalysisCoordinator {
	constructor({ logger, subtitleKeywordDetector, directionKeywordDetector }) {
		this.logger = logger;
		this.subtitleKeywordDetector = subtitleKeywordDetector;
		this.directionKeywordDetector = directionKeywordDetector;
		this.nativeWorker = new NativeSubtitleAnalysisWorker();
		this.lastBackendMode = "";
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
				this.reportBackendMode("combined-rust");
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
			this.logger.error(
				`Live subtitle combined native analysis failed: ${_error?.message || "unknown error"}`,
			);
		}

		this.reportBackendMode("dedicated-rust");
		await this.handleWithExistingDetectors(snapshot);
	}

	async handleWithExistingDetectors(snapshot = {}) {
		await Promise.allSettled([
			this.subtitleKeywordDetector.handleSnapshot(snapshot),
			this.directionKeywordDetector.handleSnapshot(snapshot),
		]);
	}

	reportBackendMode(mode) {
		if (!mode || mode === this.lastBackendMode) {
			return;
		}

		this.lastBackendMode = mode;
		this.logger.debug(
			`Live subtitle analysis backend: ${mode === "combined-rust" ? "Rust combined worker" : "Rust dedicated workers"}`,
		);
	}
}

module.exports = LiveSubtitleAnalysisCoordinator;
