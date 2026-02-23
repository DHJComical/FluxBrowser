const { app } = require("electron");
const log = require("electron-log");

module.exports = {
	name: "SiteFixes",
	initialize: (core) => {
		log.info("[Plugin: SiteFixes] 已加载，正在监听网页内容...");

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
						log.info("[SiteFixes] 成功为 Bilibili 注入顶栏修复 CSS");
					}).catch(err => {
						log.error("[SiteFixes] 为 Bilibili 注入 CSS 失败:", err);
					});
				}
				
			});
		});
	}
};