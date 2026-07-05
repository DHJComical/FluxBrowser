const { spawn } = require("child_process");
const { resolveNativeBinaryPath } = require("./resolveNativeBinaryPath");

const NATIVE_BINARY_NAME =
	process.platform === "win32" ? "flux-native.exe" : "flux-native";

class NativeLineWorkerClient {
	constructor({ workerCommand, requestIdPrefix, logPrefix, workerLabel }) {
		this.workerCommand = workerCommand;
		this.requestIdPrefix = requestIdPrefix;
		this.logPrefix = logPrefix;
		this.workerLabel = workerLabel;
		this.worker = null;
		this.outputBuffer = "";
		this.pendingRequests = new Map();
		this.requestSerial = 0;
		this.stopping = false;
		this.exitCleanupRegistered = false;
		this.nativeAvailable = process.platform === "win32";
		this.nativeUnavailableReason = "";
		this.fallbackWarningShown = false;
	}

	log(message) {
		console.info(`[${this.logPrefix}] ${message}`);
	}

	warnNativeFallback(reason) {
		if (this.fallbackWarningShown) return;
		this.fallbackWarningShown = true;
		console.warn(
			`FluxBrowser native ${this.workerLabel} unavailable, falling back to JS. ${reason}`,
		);
	}

	resolveBinaryPath() {
		return resolveNativeBinaryPath(NATIVE_BINARY_NAME);
	}

	markNativeUnavailable(reason) {
		this.nativeAvailable = false;
		this.nativeUnavailableReason = reason || "unknown reason";
		this.warnNativeFallback(this.nativeUnavailableReason);
	}

	rejectPendingRequests(error) {
		this.pendingRequests.forEach(({ reject }) => reject(error));
		this.pendingRequests.clear();
	}

	stopWorker() {
		if (this.worker && !this.worker.killed) {
			this.stopping = true;
			this.worker.kill();
		}
		this.worker = null;
		this.outputBuffer = "";
	}

	handleWorkerMessage(line) {
		let payload = null;
		try {
			payload = JSON.parse(line);
		} catch (_error) {
			return;
		}

		const requestId =
			payload && typeof payload.requestId === "string" ? payload.requestId : "";
		if (!requestId || !this.pendingRequests.has(requestId)) {
			return;
		}

		const { resolve } = this.pendingRequests.get(requestId);
		this.pendingRequests.delete(requestId);
		resolve(payload);
	}

	attachWorker(worker, binaryPath) {
		this.worker = worker;
		this.outputBuffer = "";

		if (worker.stdout) {
			worker.stdout.on("data", (data) => {
				this.outputBuffer += data.toString();
				const lines = this.outputBuffer.split(/\r?\n/);
				this.outputBuffer = lines.pop() || "";
				lines
					.map((line) => line.trim())
					.filter(Boolean)
					.forEach((line) => this.handleWorkerMessage(line));
			});
		}

		worker.on("error", (error) => {
			const failure = error || new Error(`native ${this.workerLabel} error`);
			if (!this.stopping) {
				this.markNativeUnavailable(failure.message);
			}
			this.worker = null;
			this.outputBuffer = "";
			this.stopping = false;
			this.rejectPendingRequests(failure);
		});

		worker.on("close", (code) => {
			const closedIntentionally = this.stopping;
			this.worker = null;
			this.outputBuffer = "";
			this.stopping = false;

			if (!closedIntentionally) {
				const failure = new Error(
					`native ${this.workerLabel} exited with code ${code ?? "unknown"}`,
				);
				this.markNativeUnavailable(failure.message);
				this.rejectPendingRequests(failure);
			}
		});

		if (!this.exitCleanupRegistered) {
			this.exitCleanupRegistered = true;
			process.once("exit", () => this.stopWorker());
		}

		this.log(`Started ${this.workerLabel} via Rust: ${binaryPath}`);
		return worker;
	}

	ensureWorker() {
		if (!this.nativeAvailable) {
			return null;
		}

		if (this.worker && !this.worker.killed) {
			return this.worker;
		}

		const binaryPath = this.resolveBinaryPath();
		if (!binaryPath) {
			this.markNativeUnavailable("native binary not found");
			return null;
		}

		try {
			const worker = spawn(binaryPath, [this.workerCommand], {
				windowsHide: true,
			});
			return this.attachWorker(worker, binaryPath);
		} catch (error) {
			this.markNativeUnavailable(error.message || "spawn failed");
			return null;
		}
	}

	request(payload = {}) {
		const worker = this.ensureWorker();
		if (!worker || !worker.stdin || worker.stdin.destroyed) {
			return null;
		}

		const requestId = `${this.requestIdPrefix}-${(++this.requestSerial).toString(36)}`;
		const serialized = JSON.stringify({
			...payload,
			requestId,
		});

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(requestId, { resolve, reject });
			worker.stdin.write(`${serialized}\n`, (error) => {
				if (!error) return;
				this.pendingRequests.delete(requestId);
				reject(error);
			});
		});
	}
}

module.exports = NativeLineWorkerClient;
