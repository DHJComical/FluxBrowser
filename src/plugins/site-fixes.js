const { app } = require("electron");
const log = require("electron-log");
const { t } = require("../main/i18n");

module.exports = {
	name: "SiteFixes",
	initialize: (core) => {
		log.info(t("logs.siteFixes.loaded"));

		app.on("web-contents-created", (event, webContents) => {
			webContents.on("did-finish-load", () => {
				const currentUrl = webContents.getURL();

				// ===== Bilibili 修复规则 =====
				if (currentUrl.includes("bilibili.com")) {
					webContents.insertCSS(`
						/* 只把真正悬浮的顶栏内部元素改为绝对定位，允许横向滚动 */
						.bili-header__bar {
							position: absolute !important; 
							width: 100% !important;
							min-width: 1050px !important; 
							top: 0 !important;
							left: 0 !important;
						}
						
						/* 保留父级占位容器，防止下方视频内容上移被遮挡 */
						#biliMainHeader, 
						.bili-header {
							position: relative !important; 
							min-width: 1050px !important; 
							/* 强制去除可能存在的 fixed，恢复其纯占位功能 */
						}
					`).then(() => {
						log.info(t("logs.siteFixes.bilibiliCssInjected"));
					}).catch(err => {
						log.error(t("logs.siteFixes.bilibiliCssFailed"), err);
					});
				}
				
			});
		});
	}
};
