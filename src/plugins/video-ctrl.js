export const name = "VideoController";
export const shortcuts = {
	"Alt+Space": (core) => {
		// 暂停/播放 JS 脚本
		core.executeOnWebview(`
          var v = document.querySelector('video');
          if(v) v.paused ? v.play() : v.pause();
        `);
	},
	"Alt+Right": (core) => {
		// 快进 JS 脚本
		core.executeOnWebview(`
          var v = document.querySelector('video');
          if(v) v.currentTime += 10;
        `);
	},
};
