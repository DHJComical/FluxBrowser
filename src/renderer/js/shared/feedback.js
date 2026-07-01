let feedbackUI = null;

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
		"取消",
	);
	const confirmButton = createElement(
		"button",
		"feedback-btn feedback-btn-primary",
		"确认",
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
		return { icon: "check_circle", title: "已完成" };
	}
	if (type === "error") {
		return { icon: "error", title: "操作失败" };
	}
	if (type === "warning") {
		return { icon: "warning", title: "请注意" };
	}
	return { icon: "info", title: "提示" };
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
		title || meta.title,
	);
	const toastMessage = createElement(
		"div",
		"feedback-toast-message",
		message,
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
		title = "请确认操作",
		message = "",
		confirmText = "确认",
		cancelText = "取消",
		tone = "primary",
	} = options;

	ui.confirmTitle.textContent = title;
	ui.confirmMessage.textContent = message;
	ui.cancelButton.textContent = cancelText;
	ui.confirmButton.textContent = confirmText;
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
