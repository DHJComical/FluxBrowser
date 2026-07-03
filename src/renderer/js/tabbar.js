const { ipcRenderer } = require("electron");
const { initI18n, t } = require("./js/shared/i18n");

const strip = document.getElementById("tabbar-strip");
const addBtn = document.getElementById("tabbar-add-btn");
const HYDRATE_RETRY_LIMIT = 10;

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
	element.title = tab.title || tab.url || t("main.tabs.newTab");

	const title = document.createElement("span");
	title.className = "tab-pill-title";
	title.textContent = tab.title || tab.url || t("main.tabs.newTab");

	const closeBtn = document.createElement("span");
	closeBtn.className = "tab-pill-close material-icons";
	closeBtn.textContent = "close";
	closeBtn.title = t("main.tabs.closeTab");

	closeBtn.addEventListener("click", (event) => {
		event.stopPropagation();
		ipcRenderer.send("close-tab", tab.id);
	});

	element.addEventListener("click", () => {
		window.dispatchEvent(
			new CustomEvent("flux-tab-click-activate", {
				detail: { tabId: tab.id },
			}),
		);
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
	if (!strip) return;
	strip.innerHTML = "";
	tabsState.tabs.forEach((tab) => {
		strip.appendChild(buildTabElement(tab));
	});
	requestAnimationFrame(scrollActiveTabIntoView);
}

async function hydrate(attempt = 0) {
	try {
		await initI18n();
		tabsState = await ipcRenderer.invoke("get-tabs-state");
		renderTabs();
	} catch (error) {
		console.error("tabbar hydrate failed:", error);
		if (attempt >= HYDRATE_RETRY_LIMIT) {
			return;
		}
		setTimeout(() => {
			hydrate(attempt + 1);
		}, 150 * (attempt + 1));
	}
}

function bindEvents() {
	if (!strip || !addBtn) return;

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

	window.addEventListener("flux-language-changed", renderTabs);

}

bindEvents();
hydrate();
