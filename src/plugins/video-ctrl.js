module.exports = {
	name: "VideoController",
	shortcuts: {
		"Video-Pause": (core) => {
			core.executeOnWebview(`
                var v = document.querySelector('video');
                if(v) v.paused ? v.play() : v.pause();
            `);
		},
		"Video-Forward": (core) => {
			core.executeOnWebview(`
                var v = document.querySelector('video');
                if(v) v.currentTime += 10;
            `);
		},
		"Video-Backward": (core) => {
			core.executeOnWebview(`
                var v = document.querySelector('video');
                if(v) v.currentTime -= 10;
            `);
		},
	},
};
