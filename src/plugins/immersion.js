let isImmersion = false;

module.exports = {
    name: "ImmersionMode",
    shortcuts: {
        "ImmersionMode": (core) => {
            isImmersion = !isImmersion;
            core.setIgnoreMouse(isImmersion);
            core.setAlwaysOnTop(isImmersion);
            core.sendToRenderer("toggle-immersion-ui", isImmersion);
        },
    }
};