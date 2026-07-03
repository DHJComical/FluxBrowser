const {
	DEFAULT_LOCALE,
	createTranslator,
	normalizeLocale,
} = require("../i18n");

const translator = createTranslator(DEFAULT_LOCALE);
const translationKeyPattern = /^[a-z]+(?:\.[\w-]+)+$/;

function isPlainParams(value) {
	if (!value || typeof value !== "object") {
		return false;
	}
	if (value instanceof Error || Array.isArray(value)) {
		return false;
	}
	return Object.getPrototypeOf(value) === Object.prototype;
}

function setLocale(locale) {
	return translator.setLocale(locale);
}

function getLocale() {
	return translator.getLocale();
}

function t(key, params = {}) {
	return translator.t(key, params);
}

function isTranslationKey(value) {
	return typeof value === "string" && translationKeyPattern.test(value);
}

function translateMaybeKey(value, params = {}) {
	return isTranslationKey(value) ? t(value, params) : value;
}

function translateLogArgs(args = []) {
	return args.map((arg) => {
		if (typeof arg !== "string") {
			return arg;
		}
		return translateMaybeKey(arg);
	});
}

function translateMessage(key, params = {}) {
	return translateMaybeKey(key, params);
}

module.exports = {
	DEFAULT_LOCALE,
	normalizeLocale,
	setLocale,
	getLocale,
	t,
	isTranslationKey,
	translateMaybeKey,
	translateLogArgs,
	translateMessage,
	isPlainParams,
};
