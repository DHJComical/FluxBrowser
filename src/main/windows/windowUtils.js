const { app, screen } = require("electron");
const path = require("path");

function getWindowIconPath() {
	return path.join(app.getAppPath(), "resources/image/FluxBrowser-icon.ico");
}

function getRendererPath(fileName) {
	return path.join(__dirname, "../../renderer", fileName);
}

function getCenteredPosition(width, height) {
	const { width: screenWidth, height: screenHeight } =
		screen.getPrimaryDisplay().workAreaSize;

	return {
		x: Math.round((screenWidth - width) / 2),
		y: Math.round((screenHeight - height) / 2),
	};
}

module.exports = {
	getWindowIconPath,
	getRendererPath,
	getCenteredPosition,
};
