const { ipcRenderer } = require("electron");

const strip = document.getElementById("tabbar-strip");
const addBtn = document.getElementById("tabbar-add-btn");
const dragRegion = document.getElementById("tabbar-drag-region");

let tabsState = {
	tabs: [],
	activeTabId: null,
};

function buildTabElement(tab) {
	const element = document.createElement("button");
	element.className = "tab-pill";
	element.dataset.tabId = tab.id;
	element.classList.toggle("is-active", tab.id === tabsState.activeTabId);

	const title = document.createElement("span");
	title.className = "tab-pill-title";
	title.textContent = tab.title || tab.url || "新标签页";

	const closeBtn = document.createElement("span");
	closeBtn.className = "tab-pill-close material-icons";
	closeBtn.textContent = "close";
	closeBtn.title = "关闭标签页";

	closeBtn.addEventListener("click", (event) => {
		event.stopPropagation();
		ipcRenderer.send("close-tab", tab.id);
	});

	element.addEventListener("click", () => {
		ipcRenderer.send("activate-tab", tab.id);
	});

	element.append(title, closeBtn);
	return element;
}

function renderTabs() {
	strip.innerHTML = "";
	tabsState.tabs.forEach((tab) => {
		strip.appendChild(buildTabElement(tab));
	});
}

async function hydrate() {
	tabsState = await ipcRenderer.invoke("get-tabs-state");
	renderTabs();
}

function bindEvents() {
	addBtn.addEventListener("click", () => {
		ipcRenderer.send("create-tab");
	});

	ipcRenderer.on("tabs-state-changed", (_event, nextState) => {
		tabsState = nextState;
		renderTabs();
	});

	dragRegion.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		ipcRenderer.send("start-moving-tab-bar");
	});

	window.addEventListener("mouseup", () => {
		ipcRenderer.send("stop-moving");
	});
}

bindEvents();
hydrate();
