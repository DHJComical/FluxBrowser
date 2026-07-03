const { ipcRenderer } = require("electron");

const strip = document.getElementById("tabbar-strip");
const addBtn = document.getElementById("tabbar-add-btn");

let tabsState = {
	tabs: [],
	activeTabId: null,
};

function buildTabIcon(tab) {
	if (tab.favicon) {
		const favicon = document.createElement("img");
		favicon.className = "tab-pill-favicon";
		favicon.src = tab.favicon;
		favicon.alt = "";
		favicon.draggable = false;
		favicon.addEventListener("error", () => {
			favicon.replaceWith(buildTabIcon({}));
		});
		return favicon;
	}

	const fallbackIcon = document.createElement("span");
	fallbackIcon.className = "tab-pill-fallback material-icons";
	fallbackIcon.textContent = "language";
	return fallbackIcon;
}

function buildTabElement(tab) {
	const element = document.createElement("button");
	element.className = "tab-pill";
	element.dataset.tabId = tab.id;
	element.classList.toggle("is-active", tab.id === tabsState.activeTabId);
	element.title = tab.title || tab.url || "New tab";

	const title = document.createElement("span");
	title.className = "tab-pill-title";
	title.textContent = tab.title || tab.url || "New tab";

	const closeBtn = document.createElement("span");
	closeBtn.className = "tab-pill-close material-icons";
	closeBtn.textContent = "close";
	closeBtn.title = "Close tab";

	closeBtn.addEventListener("click", (event) => {
		event.stopPropagation();
		ipcRenderer.send("close-tab", tab.id);
	});

	element.addEventListener("click", () => {
		ipcRenderer.send("activate-tab", tab.id);
	});

	element.append(buildTabIcon(tab), title, closeBtn);
	return element;
}

function scrollActiveTabIntoView() {
	const activeTab = strip.querySelector(".tab-pill.is-active");
	if (!activeTab) return;

	activeTab.scrollIntoView({
		behavior: "smooth",
		block: "nearest",
		inline: "nearest",
	});
}

function renderTabs() {
	strip.innerHTML = "";
	tabsState.tabs.forEach((tab) => {
		strip.appendChild(buildTabElement(tab));
	});
	requestAnimationFrame(scrollActiveTabIntoView);
}

async function hydrate() {
	tabsState = await ipcRenderer.invoke("get-tabs-state");
	renderTabs();
}

function bindEvents() {
	addBtn.addEventListener("click", () => {
		ipcRenderer.send("create-tab");
	});

	strip.addEventListener(
		"wheel",
		(event) => {
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
			event.preventDefault();
			strip.scrollLeft += event.deltaY;
		},
		{ passive: false },
	);

	ipcRenderer.on("tabs-state-changed", (_event, nextState) => {
		tabsState = nextState;
		renderTabs();
	});

}

bindEvents();
hydrate();
