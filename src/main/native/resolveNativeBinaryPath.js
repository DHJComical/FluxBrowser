const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function getProjectRoot() {
	return path.resolve(__dirname, "../../..");
}

function resolveNativeBinaryPath(binaryName) {
	if (!binaryName) return "";

	if (app.isPackaged) {
		const packagedPath = path.join(process.resourcesPath, "native", binaryName);
		return fs.existsSync(packagedPath) ? packagedPath : "";
	}

	const candidates = [
		path.join(
			getProjectRoot(),
			"native",
			"flux-native",
			"target",
			"debug",
			binaryName,
		),
		path.join(
			getProjectRoot(),
			"native",
			"flux-native",
			"target",
			"release",
			binaryName,
		),
	];

	return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

module.exports = {
	resolveNativeBinaryPath,
};
