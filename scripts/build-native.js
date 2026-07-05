const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "native", "flux-native", "Cargo.toml");
const binaryName = process.platform === "win32" ? "flux-native.exe" : "flux-native";
const args = new Set(process.argv.slice(2));
const release = args.has("--release");
const required = args.has("--required");

function log(message) {
	console.log(`[native-build] ${message}`);
}

function warn(message) {
	console.warn(`[native-build] ${message}`);
}

function exitWithFailure(message) {
	console.error(`[native-build] ${message}`);
	process.exit(1);
}

function binaryPathFor(mode) {
	return path.join(
		rootDir,
		"native",
		"flux-native",
		"target",
		mode,
		binaryName,
	);
}

if (!fs.existsSync(manifestPath)) {
	if (required) {
		exitWithFailure(`Missing Rust manifest: ${manifestPath}`);
	}
	warn("Rust sidecar project is missing. Native features will be unavailable.");
	process.exit(0);
}

const cargoCommand = process.platform === "win32" ? "cargo.exe" : "cargo";
const versionCheck = spawnSync(cargoCommand, ["--version"], {
	encoding: "utf8",
	stdio: "pipe",
});

if (versionCheck.error || versionCheck.status !== 0) {
	const reason = versionCheck.error
		? versionCheck.error.message
		: (versionCheck.stderr || "cargo --version failed").trim();
	if (required) {
		exitWithFailure(`Rust toolchain is required but unavailable: ${reason}`);
	}
	warn(`Rust toolchain not found. Native features will be unavailable. (${reason})`);
	process.exit(0);
}

const buildArgs = ["build", "--manifest-path", manifestPath];
if (release) {
	buildArgs.push("--release");
}

log(`Building Rust sidecar (${release ? "release" : "debug"})...`);

const buildResult = spawnSync(cargoCommand, buildArgs, {
	cwd: rootDir,
	stdio: "inherit",
});

if (buildResult.error || buildResult.status !== 0) {
	const reason = buildResult.error
		? buildResult.error.message
		: `cargo exited with code ${buildResult.status}`;
	if (required) {
		exitWithFailure(`Rust build failed: ${reason}`);
	}
	warn(`Rust build failed. Native features will be unavailable. (${reason})`);
	process.exit(0);
}

const outputBinaryPath = binaryPathFor(release ? "release" : "debug");
if (!fs.existsSync(outputBinaryPath)) {
	if (required) {
		exitWithFailure(`Rust build completed but binary is missing: ${outputBinaryPath}`);
	}
	warn(`Rust build completed without an output binary. (${outputBinaryPath})`);
	process.exit(0);
}

log(`Native sidecar ready: ${outputBinaryPath}`);
