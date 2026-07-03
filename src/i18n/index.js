const zhCN = require("./locales/zh-CN.json");
const enUS = require("./locales/en-US.json");

const DEFAULT_LOCALE = "zh-CN";
const dictionaries = {
	"zh-CN": zhCN,
	"en-US": enUS,
};

function normalizeLocale(locale) {
	const value = String(locale || "").trim().toLowerCase();
	if (value === "en" || value === "en-us") return "en-US";
	if (value === "zh" || value === "zh-cn" || value === "zh-hans") return "zh-CN";
	return DEFAULT_LOCALE;
}

function interpolate(template, params = {}) {
	return String(template).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
		if (!Object.hasOwn(params, key)) {
			return "";
		}
		return String(params[key]);
	});
}

function translate(locale, key, params = {}) {
	const normalizedLocale = normalizeLocale(locale);
	const dictionary = dictionaries[normalizedLocale] || {};
	const fallbackDictionary = dictionaries[DEFAULT_LOCALE] || {};
	const template =
		dictionary[key] ??
		fallbackDictionary[key] ??
		key;

	return interpolate(template, params);
}

function createTranslator(initialLocale = DEFAULT_LOCALE) {
	let currentLocale = normalizeLocale(initialLocale);

	return {
		getLocale() {
			return currentLocale;
		},
		setLocale(nextLocale) {
			currentLocale = normalizeLocale(nextLocale);
			return currentLocale;
		},
		t(key, params = {}) {
			return translate(currentLocale, key, params);
		},
	};
}

module.exports = {
	DEFAULT_LOCALE,
	dictionaries,
	normalizeLocale,
	translate,
	createTranslator,
};
