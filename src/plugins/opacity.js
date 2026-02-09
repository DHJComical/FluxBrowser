module.exports = {
    name: "OpacityControl",
    shortcuts: {
        "Opacity-Up": (core) => {
            // 增加透明度 (变实)
            core.adjustOpacity(0.1);
        },
        "Opacity-Down": (core) => {
            // 减少透明度 (变虚)
            core.adjustOpacity(-0.1);
        }
    }
};