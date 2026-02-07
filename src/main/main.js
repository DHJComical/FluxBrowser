const { app } = require("electron");
const fluxCore = require("./FluxCore");
const PluginLoader = require("./PluginLoader");

app.whenReady().then(() => {
	fluxCore.launch(PluginLoader);
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
