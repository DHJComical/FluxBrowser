const { ipcRenderer } = require("electron");
const { initI18n, t } = require("./js/shared/i18n");

const strip = document.getElementById("tabbar-strip");
const addBtn = document.getElementById("tabbar-add-btn");
const HYDRATE_RETRY_LIMIT = 10;
const DRAG_START_THRESHOLD_PX = 3;

let tabsState = {
	tabs: [],
	activeTabId: null,
};
let draggingTabId = "";
let dropTargetTabId = "";
let dropTargetAfter = false;
let suppressClickTabId = "";
let pendingDrag = null;
let dragGhost = null;
let settleAnimationFrameId = 0;
let pendingDropAnimation = null;
let dropGhostCleanupTimerId = 0;

function cancelSettleAnimationFrame() {
	if (!settleAnimationFrameId) return;
	window.cancelAnimationFrame(settleAnimationFrameId);
	settleAnimationFrameId = 0;
}

function clearDropGhostCleanupTimer() {
	if (!dropGhostCleanupTimerId) return;
	window.clearTimeout(dropGhostCleanupTimerId);
	dropGhostCleanupTimerId = 0;
}

function cleanupPendingDropAnimation() {
	clearDropGhostCleanupTimer();
	if (pendingDropAnimation?.ghost) {
		pendingDropAnimation.ghost.remove();
	}
	if (pendingDropAnimation?.tabId && strip) {
		const targetElement = strip.querySelector(
			`.tab-pill[data-tab-id="${CSS.escape(pendingDropAnimation.tabId)}"]`,
		);
		targetElement?.classList.remove("is-drop-settling-source");
	}
	pendingDropAnimation = null;
}

function captureTabRects() {
	if (!strip) return new Map();

	return new Map(
		Array.from(strip.querySelectorAll(".tab-pill"))
			.map((element) => [element.dataset.tabId, element.getBoundingClientRect()])
			.filter(([tabId]) => Boolean(tabId)),
	);
}

function animateTabReflow(previousRects) {
	if (!strip || !(previousRects instanceof Map) || previousRects.size === 0) {
		return;
	}

	const animatedElements = [];
	Array.from(strip.querySelectorAll(".tab-pill")).forEach((element) => {
		if (
			pendingDropAnimation &&
			pendingDropAnimation.tabId === element.dataset.tabId
		) {
			return;
		}
		const previousRect = previousRects.get(element.dataset.tabId);
		if (!previousRect) return;

		const nextRect = element.getBoundingClientRect();
		const deltaX = previousRect.left - nextRect.left;
		const deltaY = previousRect.top - nextRect.top;
		if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
			return;
		}

		element.classList.add("is-settling");
		element.style.transition = "none";
		element.style.transform = `translate(${Math.round(deltaX)}px, ${Math.round(deltaY)}px)`;
		animatedElements.push(element);
	});

	if (animatedElements.length === 0) {
		return;
	}

	cancelSettleAnimationFrame();
	settleAnimationFrameId = window.requestAnimationFrame(() => {
		settleAnimationFrameId = window.requestAnimationFrame(() => {
			settleAnimationFrameId = 0;
			animatedElements.forEach((element) => {
				element.style.transition = "";
				element.style.transform = "";
			});
		});
	});

	animatedElements.forEach((element) => {
		window.setTimeout(() => {
			element.classList.remove("is-settling");
			element.style.transition = "";
			element.style.transform = "";
		}, 260);

		element.addEventListener(
			"transitionend",
			() => {
				element.classList.remove("is-settling");
				element.style.transition = "";
				element.style.transform = "";
			},
			{ once: true },
		);
	});
}

function animateDroppedGhost() {
	if (!pendingDropAnimation?.ghost || !strip) {
		return;
	}

	const targetElement = strip.querySelector(
		`.tab-pill[data-tab-id="${CSS.escape(pendingDropAnimation.tabId)}"]`,
	);
	if (!targetElement) {
		cleanupPendingDropAnimation();
		return;
	}

	const targetRect = targetElement.getBoundingClientRect();
	targetElement.classList.add("is-drop-settling-source");

	const ghost = pendingDropAnimation.ghost;
	ghost.classList.add("is-drop-settling");
	ghost.style.width = `${Math.round(targetRect.width)}px`;

	window.requestAnimationFrame(() => {
		ghost.style.transform = `translate(${Math.round(targetRect.left)}px, ${Math.round(
			targetRect.top,
		)}px)`;
	});

	clearDropGhostCleanupTimer();
	dropGhostCleanupTimerId = window.setTimeout(() => {
		targetElement.classList.remove("is-drop-settling-source");
		cleanupPendingDropAnimation();
	}, 260);

	ghost.addEventListener(
		"transitionend",
		() => {
			targetElement.classList.remove("is-drop-settling-source");
			cleanupPendingDropAnimation();
		},
		{ once: true },
	);
}

function applyDragIndicatorClasses() {
	if (!strip) return;

	strip.querySelectorAll(".tab-pill").forEach((element) => {
		element.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
	});

	strip.querySelectorAll(".tab-pill").forEach((element) => {
		const tabId = element.dataset.tabId;
		element.classList.toggle("is-dragging", tabId === draggingTabId);
	});

	if (!dropTargetTabId) {
		return;
	}

	const targetElement = strip.querySelector(
		`.tab-pill[data-tab-id="${CSS.escape(dropTargetTabId)}"]`,
	);
	if (!targetElement) {
		return;
	}

	if (dropTargetAfter) {
		targetElement.classList.add("is-drop-after");
		const nextElement = targetElement.nextElementSibling;
		if (nextElement?.classList.contains("tab-pill")) {
			nextElement.classList.add("is-drop-before");
		}
		return;
	}

	targetElement.classList.add("is-drop-before");
	const previousElement = targetElement.previousElementSibling;
	if (previousElement?.classList.contains("tab-pill")) {
		previousElement.classList.add("is-drop-after");
	}
}

function suppressNextClick(tabId) {
	if (!tabId) return;
	suppressClickTabId = tabId;
	window.setTimeout(() => {
		if (suppressClickTabId === tabId) {
			suppressClickTabId = "";
		}
	}, 160);
}

function removeDragGhost() {
	if (!dragGhost) return;
	dragGhost.remove();
	dragGhost = null;
}

function updateDragGhostPosition(clientX, clientY) {
	if (!dragGhost || !pendingDrag) return;

	const nextLeft = clientX - pendingDrag.pointerOffsetX;
	const nextTop = clientY - pendingDrag.pointerOffsetY;
	dragGhost.style.transform = `translate(${Math.round(nextLeft)}px, ${Math.round(
		nextTop,
	)}px)`;
}

function createDragGhost(sourceElement, clientX, clientY) {
	if (!sourceElement) return;

	removeDragGhost();
	const ghost = sourceElement.cloneNode(true);
	ghost.classList.remove("is-active", "is-dragging", "is-drop-before", "is-drop-after");
	ghost.classList.add("tab-pill-drag-ghost");
	ghost.style.width = `${Math.round(sourceElement.getBoundingClientRect().width)}px`;
	document.body.appendChild(ghost);
	dragGhost = ghost;
	updateDragGhostPosition(clientX, clientY);
}

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
		if (suppressClickTabId === tab.id) {
			suppressClickTabId = "";
			return;
		}
		window.dispatchEvent(
			new CustomEvent("flux-tab-click-activate", {
				detail: { tabId: tab.id },
			}),
		);
		ipcRenderer.send("activate-tab", tab.id);
	});

	element.addEventListener("pointerdown", (event) => {
		if (event.button !== 0) return;
		if (event.target.closest(".tab-pill-close")) return;

		const rect = element.getBoundingClientRect();
		if (typeof element.setPointerCapture === "function") {
			try {
				element.setPointerCapture(event.pointerId);
			} catch (_error) {
				// Ignore pointer capture failures and keep drag behavior available.
			}
		}

		pendingDrag = {
			tabId: tab.id,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			pointerOffsetX: event.clientX - rect.left,
			pointerOffsetY: event.clientY - rect.top,
			sourceElement: element,
			started: false,
		};
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
	const previousRects = captureTabRects();
	cancelSettleAnimationFrame();
	strip.innerHTML = "";
	tabsState.tabs.forEach((tab) => {
		strip.appendChild(buildTabElement(tab));
	});
	applyDragIndicatorClasses();
	animateTabReflow(previousRects);
	animateDroppedGhost();
	requestAnimationFrame(scrollActiveTabIntoView);
}

function getDragTargetInfo(clientX) {
	const tabElements = Array.from(strip.querySelectorAll(".tab-pill")).filter(
		(element) => element.dataset.tabId !== draggingTabId,
	);
	if (tabElements.length === 0) {
		return null;
	}

	for (let index = 0; index < tabElements.length; index += 1) {
		const element = tabElements[index];
		const rect = element.getBoundingClientRect();
		const midpoint = rect.left + rect.width / 2;
		if (clientX <= midpoint) {
			return {
				targetTabId: element.dataset.tabId,
				placeAfter: false,
			};
		}
	}

	const lastElement = tabElements[tabElements.length - 1];
	return {
		targetTabId: lastElement.dataset.tabId,
		placeAfter: true,
	};
}

function clearDragState() {
	removeDragGhost();
	pendingDrag = null;
	draggingTabId = "";
	dropTargetTabId = "";
	dropTargetAfter = false;
	applyDragIndicatorClasses();
}

function updateDragTarget(clientX) {
	if (!draggingTabId) return;
	const targetInfo = getDragTargetInfo(clientX);
	if (!targetInfo) {
		dropTargetTabId = "";
		dropTargetAfter = false;
		applyDragIndicatorClasses();
		return;
	}

	const changed =
		dropTargetTabId !== targetInfo.targetTabId ||
		dropTargetAfter !== targetInfo.placeAfter;
	if (!changed) return;

	dropTargetTabId = targetInfo.targetTabId;
	dropTargetAfter = targetInfo.placeAfter;
	applyDragIndicatorClasses();
}

function bindDragEvents() {
	window.addEventListener("pointermove", (event) => {
		if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) {
			return;
		}

		const deltaX = event.clientX - pendingDrag.startX;
		const deltaY = event.clientY - pendingDrag.startY;
		if (!pendingDrag.started) {
			if (
				Math.hypot(deltaX, deltaY) < DRAG_START_THRESHOLD_PX
			) {
				return;
			}

			pendingDrag.started = true;
			draggingTabId = pendingDrag.tabId;
			dropTargetTabId = "";
			dropTargetAfter = false;
			suppressNextClick(pendingDrag.tabId);
			createDragGhost(
				pendingDrag.sourceElement,
				event.clientX,
				event.clientY,
			);
			applyDragIndicatorClasses();
		}

		event.preventDefault();
		updateDragGhostPosition(event.clientX, event.clientY);
		updateDragTarget(event.clientX);
	});

	window.addEventListener("pointerup", (event) => {
		if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) {
			return;
		}

		if (pendingDrag.started) {
			const targetInfo =
				dropTargetTabId && draggingTabId
					? {
							targetTabId: dropTargetTabId,
							placeAfter: dropTargetAfter,
						}
					: getDragTargetInfo(event.clientX);
			if (targetInfo && targetInfo.targetTabId !== pendingDrag.tabId) {
				cleanupPendingDropAnimation();
				pendingDropAnimation = dragGhost
					? {
							tabId: pendingDrag.tabId,
							ghost: dragGhost,
						}
					: null;
				dragGhost = null;
				ipcRenderer.send("reorder-tabs", {
					draggedTabId: pendingDrag.tabId,
					targetTabId: targetInfo.targetTabId,
					placeAfter: targetInfo.placeAfter,
				});
			}
		}

		clearDragState();
	});

	window.addEventListener("pointercancel", () => {
		if (!pendingDrag) return;
		clearDragState();
	});

	window.addEventListener("blur", () => {
		if (!pendingDrag) return;
		clearDragState();
	});
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

bindDragEvents();
bindEvents();
hydrate();
