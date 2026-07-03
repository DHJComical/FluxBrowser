let feedbackUI = null;
const { t, translateMaybeKey } = require("./i18n");

function createElement(tagName, className, textContent) {
	const element = document.createElement(tagName);
	if (className) {
		element.className = className;
	}
	if (textContent !== undefined) {
		element.textContent = textContent;
	}
	return element;
}

function ensureFeedbackUI() {
	if (feedbackUI) {
		return feedbackUI;
	}

	const toastStack = createElement("div", "feedback-toast-stack");

	const confirmScrim = createElement("div", "feedback-confirm-scrim hidden");
	const confirmDialog = createElement("div", "feedback-confirm-dialog");
	const confirmTitle = createElement("div", "feedback-confirm-title");
	const confirmMessage = createElement("div", "feedback-confirm-message");
	const confirmActions = createElement("div", "feedback-confirm-actions");
	const cancelButton = createElement(
		"button",
		"feedback-btn feedback-btn-secondary",
		t("common.actions.cancel"),
	);
	const confirmButton = createElement(
		"button",
		"feedback-btn feedback-btn-primary",
		t("common.actions.confirm"),
	);

	confirmActions.append(cancelButton, confirmButton);
	confirmDialog.append(confirmTitle, confirmMessage, confirmActions);
	confirmScrim.appendChild(confirmDialog);
	document.body.append(toastStack, confirmScrim);

	feedbackUI = {
		toastStack,
		confirmScrim,
		confirmTitle,
		confirmMessage,
		cancelButton,
		confirmButton,
		resolveConfirm: null,
	};

	cancelButton.addEventListener("click", () => settleConfirm(false));
	confirmButton.addEventListener("click", () => settleConfirm(true));
	confirmScrim.addEventListener("click", (event) => {
		if (event.target === confirmScrim) {
			settleConfirm(false);
		}
	});
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			settleConfirm(false);
		}
	});

	return feedbackUI;
}

function settleConfirm(result) {
	const ui = ensureFeedbackUI();
	if (!ui.resolveConfirm) return;

	const resolve = ui.resolveConfirm;
	ui.resolveConfirm = null;
	ui.confirmScrim.classList.add("hidden");
	resolve(result);
}

function getToastMeta(type) {
	if (type === "success") {
		return { icon: "check_circle", title: t("common.toast.done") };
	}
	if (type === "error") {
		return { icon: "error", title: t("common.toast.failed") };
	}
	if (type === "warning") {
		return { icon: "warning", title: t("common.toast.attention") };
	}
	return { icon: "info", title: t("common.toast.notice") };
}

function showToast(message, options = {}) {
	const ui = ensureFeedbackUI();
	const { type = "info", duration = 2200, title } = options;
	const meta = getToastMeta(type);

	const toast = createElement("div", `feedback-toast feedback-toast-${type}`);
	const icon = createElement("i", "material-icons feedback-toast-icon");
	icon.textContent = meta.icon;

	const content = createElement("div", "feedback-toast-content");
	const toastTitle = createElement(
		"div",
		"feedback-toast-title",
		translateMaybeKey(title || meta.title),
	);
	const toastMessage = createElement(
		"div",
		"feedback-toast-message",
		translateMaybeKey(message),
	);

	content.append(toastTitle, toastMessage);
	toast.append(icon, content);
	ui.toastStack.appendChild(toast);

	requestAnimationFrame(() => {
		toast.classList.add("is-visible");
	});

	const removeToast = () => {
		toast.classList.remove("is-visible");
		setTimeout(() => {
			toast.remove();
		}, 180);
	};

	setTimeout(removeToast, duration);
	return removeToast;
}

function confirmAction(options = {}) {
	const ui = ensureFeedbackUI();
	if (ui.resolveConfirm) {
		settleConfirm(false);
	}

	const {
		title = "common.confirm.title",
		message = "",
		confirmText = "common.actions.confirm",
		cancelText = "common.actions.cancel",
		tone = "primary",
	} = options;

	ui.confirmTitle.textContent = translateMaybeKey(title);
	ui.confirmMessage.textContent = translateMaybeKey(message);
	ui.cancelButton.textContent = translateMaybeKey(cancelText);
	ui.confirmButton.textContent = translateMaybeKey(confirmText);
	ui.confirmButton.className = `feedback-btn feedback-btn-${tone}`;
	ui.confirmScrim.classList.remove("hidden");

	return new Promise((resolve) => {
		ui.resolveConfirm = resolve;
	});
}

module.exports = {
	showToast,
	confirmAction,
};
