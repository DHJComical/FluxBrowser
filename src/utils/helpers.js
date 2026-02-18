/**
 * 工具函数库
 * 包含项目中可重用的辅助函数
 */

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
	const output = Object.assign({}, target);
	
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			if (isObject(source[key])) {
				if (!(key in target)) {
					Object.assign(output, { [key]: source[key] });
				} else {
					output[key] = deepMerge(target[key], source[key]);
				}
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}
	
	return output;
}

/**
 * 检查是否为对象
 * @param {*} item - 要检查的值
 * @returns {boolean} 是否为对象
 */
function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit) {
	let inThrottle;
	return function(...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * 生成唯一ID
 * @param {number} length - ID长度
 * @returns {string} 唯一ID
 */
function generateId(length = 8) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * 安全解析JSON
 * @param {string} jsonString - JSON字符串
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析后的值或默认值
 */
function safeJsonParse(jsonString, defaultValue = null) {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		return defaultValue;
	}
}

/**
 * 验证快捷键格式
 * @param {string} shortcut - 快捷键字符串
 * @returns {boolean} 是否有效
 */
function validateShortcut(shortcut) {
	if (!shortcut || typeof shortcut !== 'string') {
		return false;
	}
	
	// 简单的格式验证
	const invalidChars = /[<>:"|?*]/;
	if (invalidChars.test(shortcut)) {
		return false;
	}
	
	// 至少需要一个非修饰键
	const modifiers = ['Control', 'Ctrl', 'Alt', 'Shift', 'Command', 'Cmd', 'Option', 'Opt'];
	const parts = shortcut.split('+').map(part => part.trim());
	const hasNonModifier = parts.some(part => !modifiers.includes(part));
	
	return hasNonModifier;
}

module.exports = {
	formatFileSize,
	deepMerge,
	isObject,
	debounce,
	throttle,
	generateId,
	safeJsonParse,
	validateShortcut
};
