const { ipcRenderer } = require("electron");
const debugLog = require("./debug");
const { getActiveWebview } = require("./tabs");

const SUBTITLE_SNAPSHOT_SCRIPT = `
	(() => {
		const normalizeText = (value) =>
			String(value || "")
				.replace(/\\s+/g, " ")
				.replace(/\\u200b/g, "")
				.trim();

		const isVisible = (element) => {
			if (!element || !(element instanceof Element)) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				Number(style.opacity) === 0
			) {
				return false;
			}

			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		};

		const getUniqueLines = (lines) => {
			const seen = new Set();
			return lines.filter((line) => {
				const normalized = normalizeText(line);
				if (!normalized || seen.has(normalized)) return false;
				seen.add(normalized);
				return true;
			});
		};

		const selectorGroups = [
			{
				source: "youtube",
				selectors: [
					".ytp-caption-window-container .caption-visual-line",
					".ytp-caption-window-container .ytp-caption-segment",
					".captions-text .caption-visual-line",
				],
			},
			{
				source: "bilibili",
				selectors: [
					".bpx-player-subtitle-panel-text",
					".bpx-player-subtitle-wrap .bpx-player-subtitle-item-text",
					".bpx-player-subtitle-wrap .bpx-player-subtitle-item",
					".squirtle-subtitle-item-text",
					".bilibili-player-video-subtitle-content .subtitle-item-text",
				],
			},
			{
				source: "generic-live",
				selectors: [
					'[aria-live="assertive"]',
					'[aria-live="polite"]',
					'[role="alert"]',
					'[data-purpose*="caption"]',
				],
			},
			{
				source: "generic-class",
				selectors: [
					'[class*="caption"]',
					'[class*="subtitle"]',
					'[class*="subtitles"]',
					'[class*="cue"]',
				],
			},
		];

		for (const group of selectorGroups) {
			for (const selector of group.selectors) {
				const candidates = Array.from(document.querySelectorAll(selector))
					.filter(isVisible)
					.map((element) => normalizeText(element.textContent))
					.filter(Boolean)
					.filter((text) => text.length <= 240);

				if (candidates.length === 0) continue;

				const lines = getUniqueLines(candidates);
				if (lines.length === 0) continue;

				return {
					found: true,
					site: location.hostname,
					title: document.title || "",
					url: location.href,
					source: group.source,
					lines,
					text: lines.join("\\n"),
					updatedAt: Date.now(),
				};
			}
		}

		return {
			found: false,
			site: location.hostname,
			title: document.title || "",
			url: location.href,
			source: "",
			lines: [],
			text: "",
			updatedAt: Date.now(),
		};
	})()
`;

function safeHostname(url) {
	try {
		return new URL(String(url || "")).hostname;
	} catch (_error) {
		return "";
	}
}

function bindSubtitleCollectorEvents() {
	ipcRenderer.on("toggle-live-subtitle-capture", () => {
		ipcRenderer.send("toggle-live-subtitle-capture");
	});

	ipcRenderer.on("collect-live-subtitle-snapshot", async (_event, payload = {}) => {
		const requestId =
			typeof payload.requestId === "string" ? payload.requestId : "";
		const webview = getActiveWebview();

		if (!webview) {
			ipcRenderer.send("live-subtitle-snapshot", {
				requestId,
				found: false,
				site: "",
				title: "",
				url: "",
				source: "",
				lines: [],
				text: "",
				updatedAt: Date.now(),
			});
			return;
		}

		try {
			const snapshot = await webview.executeJavaScript(SUBTITLE_SNAPSHOT_SCRIPT);
			ipcRenderer.send("live-subtitle-snapshot", {
				requestId,
				...snapshot,
			});
		} catch (error) {
			debugLog.warn("实时字幕采集失败", error);
			const currentUrl =
				typeof webview.getURL === "function" ? webview.getURL() : "";
			ipcRenderer.send("live-subtitle-snapshot", {
				requestId,
				found: false,
				site: safeHostname(currentUrl),
				title:
					typeof webview.getTitle === "function" ? webview.getTitle() : "",
				url: currentUrl,
				source: "",
				lines: [],
				text: "",
				updatedAt: Date.now(),
			});
		}
	});
}

module.exports = {
	bindSubtitleCollectorEvents,
};
