function filterPat(text) {
	if (!text) return "";
	return text
		.replace(/https:\/\/[^@]+@/g, "https://***@")
		.replace(/[a-f0-9]{36,}/gi, "***PAT***");
}

function checkGitConfig(config) {
	const errors = [];
	if (!config.gitPat) errors.push("GitHub PAT");
	if (!config.gitRemote) errors.push("远程仓库地址");
	if (!config.gitName) errors.push("Git用户名");
	if (!config.gitEmail) errors.push("Git邮箱");

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
		return "网络连接失败，请检查网络或代理设置";
	}
	if (message.includes("Authentication failed")) {
		return "认证失败，请检查GitHub PAT是否正确";
	}
	if (message.includes("Repository not found")) {
		return "仓库不存在，请检查仓库地址是否正确";
	}
	return message;
}

module.exports = {
	filterPat,
	checkGitConfig,
	buildRemoteUrl,
	mapPullErrorMessage,
};
