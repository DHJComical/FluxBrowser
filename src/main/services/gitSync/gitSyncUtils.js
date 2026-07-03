const { t } = require("../../i18n");

function filterPat(text) {
	if (!text) return "";
	return text
		.replace(/https:\/\/[^@]+@/g, "https://***@")
		.replace(/[a-f0-9]{36,}/gi, "***PAT***");
}

function checkGitConfig(config) {
	const errors = [];
	if (!config.gitPat) errors.push("GitHub PAT");
	if (!config.gitRemote) errors.push(t("settings.git.remoteLabel"));
	if (!config.gitName) errors.push(t("settings.git.nameLabel"));
	if (!config.gitEmail) errors.push(t("settings.git.emailLabel"));

	if (errors.length > 0) {
		return { valid: false, missing: errors };
	}
	return { valid: true };
}

function buildRemoteUrl(config) {
	if (!config.gitPat || !config.gitRemote) {
		return null;
	}
	return `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;
}

function mapPullErrorMessage(message) {
	if (
		message.includes("Could not resolve proxy") ||
		message.includes("Connection refused") ||
		message.includes("Failed to connect")
	) {
		return t("messages.sync.networkFailed");
	}
	if (message.includes("Authentication failed")) {
		return t("messages.sync.authFailed");
	}
	if (message.includes("Repository not found")) {
		return t("messages.sync.repositoryNotFound");
	}
	return message;
}

module.exports = {
	filterPat,
	checkGitConfig,
	buildRemoteUrl,
	mapPullErrorMessage,
};
