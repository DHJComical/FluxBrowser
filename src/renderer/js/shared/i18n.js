const { ipcRenderer } = require("electron");
const {
	DEFAULT_LOCALE,
	createTranslator,
	normalizeLocale,
} = require("../../../i18n");

const translator = createTranslator(DEFAULT_LOCALE);
const translationKeyPattern = /^[a-z]+(?:\.[\w-]+)+$/;
const translatableAttributes = ["placeholder", "title", "aria-label"];
const attributeKeyMap = {
	placeholder: "i18nPlaceholder",
	title: "i18nTitle",
	"aria-label": "i18nAriaLabel",
};
const skippedTagNames = new Set([
	"SCRIPT",
	"STYLE",
	"NOSCRIPT",
	"IFRAME",
	"WEBVIEW",
]);

let initialized = false;
let initializePromise = null;
let observer = null;
let isApplyingTranslations = false;

function t(key, params = {}) {
	return translator.t(key, params);
}

function isTranslationKey(value) {
	return typeof value === "string" && translationKeyPattern.test(value);
}

function translateMaybeKey(value, params = {}) {
	return isTranslationKey(value) ? t(value, params) : value;
}

function getLocale() {
	return translator.getLocale();
}

function setLocale(locale) {
	const nextLocale = translator.setLocale(locale);
	if (document?.documentElement) {
		document.documentElement.lang = nextLocale;
	}
	return nextLocale;
}

function shouldTranslateTextNode(node) {
	if (!node || node.nodeType !== Node.TEXT_NODE) {
		return false;
	}
	if (!node.nodeValue || !node.nodeValue.trim()) {
		return false;
	}
	const parentElement = node.parentElement;
	if (!parentElement) {
		return false;
	}
	if (skippedTagNames.has(parentElement.tagName)) {
		return false;
	}
	if (parentElement.classList?.contains("material-icons")) {
		return false;
	}
	if (!parentElement.dataset?.i18n) {
		return false;
	}
	return true;
}

function translateTextNode(node) {
	if (!shouldTranslateTextNode(node)) {
		return;
	}
	const parentKey = node.parentElement?.dataset?.i18n;
	const value = String(node.nodeValue ?? "");
	const leadingWhitespace = value.match(/^\s*/)?.[0] || "";
	const trailingWhitespace = value.match(/\s*$/)?.[0] || "";
	const translatedText = `${leadingWhitespace}${t(parentKey)}${trailingWhitespace}`;
	if (node.nodeValue !== translatedText) {
		node.nodeValue = translatedText;
	}
}

function translateElementAttributes(element, captureCurrentValue = false) {
	if (!element || element.nodeType !== Node.ELEMENT_NODE) {
		return;
	}
	if (skippedTagNames.has(element.tagName)) {
		return;
	}

	translatableAttributes.forEach((attributeName) => {
		if (!element.hasAttribute(attributeName)) {
			return;
		}
		const currentValue = element.getAttribute(attributeName);
		const attributeKeyName = attributeKeyMap[attributeName];
		const configuredKey =
			attributeKeyName && element.dataset ? element.dataset[attributeKeyName] : "";
		if (!configuredKey) {
			return;
		}
		const translatedValue = t(configuredKey);
		if (currentValue !== translatedValue) {
			element.setAttribute(attributeName, translatedValue);
		}
	});
}

function translateSubtree(root, captureCurrentValue = false) {
	if (!root) {
		return;
	}

	if (root.nodeType === Node.TEXT_NODE) {
		translateTextNode(root);
		return;
	}

	if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
		return;
	}

	if (root.nodeType === Node.ELEMENT_NODE) {
		translateElementAttributes(root, captureCurrentValue);
	}

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let currentTextNode = walker.nextNode();
	while (currentTextNode) {
		translateTextNode(currentTextNode);
		currentTextNode = walker.nextNode();
	}

	if (root.querySelectorAll) {
		root.querySelectorAll("*").forEach((element) => {
			translateElementAttributes(element, captureCurrentValue);
		});
	}
}

function translateDocument() {
	if (!document) {
		return;
	}

	isApplyingTranslations = true;
	try {
		const documentTitleKey = document.documentElement.dataset.i18nDocumentTitle;
		if (documentTitleKey) {
			document.title = t(documentTitleKey);
		}
		translateSubtree(document.body || document.documentElement);
	} finally {
		isApplyingTranslations = false;
	}
}

function observeTranslations() {
	if (observer || !document?.documentElement) {
		return;
	}

	observer = new MutationObserver((mutations) => {
		if (isApplyingTranslations) {
			return;
		}

		isApplyingTranslations = true;
		try {
			mutations.forEach((mutation) => {
				if (mutation.type === "characterData") {
					translateTextNode(mutation.target);
					return;
				}

				if (mutation.type === "attributes") {
					if (
						mutation.attributeName &&
						translatableAttributes.includes(mutation.attributeName)
					) {
						translateElementAttributes(mutation.target, true);
					}
					return;
				}

				mutation.addedNodes.forEach((node) => {
					translateSubtree(node, true);
				});
			});
		} finally {
			isApplyingTranslations = false;
		}
	});

	observer.observe(document.documentElement, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: translatableAttributes,
	});
}

function dispatchLanguageChanged(locale) {
	window.dispatchEvent(
		new CustomEvent("flux-language-changed", {
			detail: { locale },
		}),
	);
}

async function initI18n() {
	if (initializePromise) {
		return initializePromise;
	}

	initializePromise = ipcRenderer
		.invoke("get-app-config")
		.then((appConfig = {}) => {
			const locale = setLocale(appConfig.language || DEFAULT_LOCALE);
			if (!initialized) {
				observeTranslations();
				ipcRenderer.on("language-changed", (_event, payload = {}) => {
					const nextLocale = setLocale(
						normalizeLocale(payload.locale || payload.language),
					);
					translateDocument();
					dispatchLanguageChanged(nextLocale);
				});
				initialized = true;
			}
			translateDocument();
			return locale;
		});

	return initializePromise;
}

function translateLogArgs(args = []) {
	return args.map((arg) => {
		if (typeof arg !== "string") {
			return arg;
		}
		return translateMaybeKey(arg);
	});
}

module.exports = {
	initI18n,
	getLocale,
	setLocale,
	t,
	isTranslationKey,
	translateMaybeKey,
	translateDocument,
	translateLogArgs,
};
