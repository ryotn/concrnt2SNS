const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const DISCORD_MENTION_ID = process.env.DISCORD_MENTION_ID;

class Logger {
	constructor(options = {}) {
		this.level = options.level || 'info';
		this.label = options.label || null;
	}

	static getInstance(options = {}) {
		if (!Logger._instance) {
			Logger._instance = new Logger(options);
		} else {
			if (options.level) Logger._instance.setLevel(options.level);
			if (options.label) Logger._instance.setLabel(options.label);
		}
		return Logger._instance;
	}

	/**
	 * Replace global console methods with Logger-backed implementations.
	 * Saves originals on `globalThis.__originalConsole` so restoreConsole() can revert.
	 */
	static overrideConsole(options = {}) {
		if (globalThis.__originalConsole) return; // already overridden
		globalThis.__originalConsole = {
			log: console.log,
			info: console.info,
			warn: console.warn,
			error: console.error,
			debug: console.debug,
		};

		const logger = Logger.getInstance(options);

		console.log = (...args) => {
			const [first, ...rest] = args;
			let isMention = false;
			if (rest.length && typeof rest[0] === 'boolean') isMention = rest.shift();
			logger.info(typeof first === 'string' ? first : JSON.stringify(first), isMention, ...rest);
		};
		console.info = (...args) => {
			const [first, ...rest] = args;
			let isMention = false;
			if (rest.length && typeof rest[0] === 'boolean') isMention = rest.shift();
			logger.info(typeof first === 'string' ? first : JSON.stringify(first), isMention, ...rest);
		};
		console.warn = (...args) => {
			const [first, ...rest] = args;
			let isMention = false;
			if (rest.length && typeof rest[0] === 'boolean') isMention = rest.shift();
			logger.warn(typeof first === 'string' ? first : JSON.stringify(first), isMention, ...rest);
		};
		console.error = (...args) => {
			const [first, ...rest] = args;
			let isMention = false;
			if (rest.length && typeof rest[0] === 'boolean') isMention = rest.shift();
			logger.error(typeof first === 'string' ? first : JSON.stringify(first), isMention, ...rest);
		};
		console.debug = (...args) => {
			const [first, ...rest] = args;
			let isMention = false;
			if (rest.length && typeof rest[0] === 'boolean') isMention = rest.shift();
			logger.debug(typeof first === 'string' ? first : JSON.stringify(first), isMention, ...rest);
		};
	}

	/** Restore original global console methods saved by overrideConsole(). */
	static restoreConsole() {
		if (!globalThis.__originalConsole) return;
		const orig = globalThis.__originalConsole;
		console.log = orig.log;
		console.info = orig.info;
		console.warn = orig.warn;
		console.error = orig.error;
		console.debug = orig.debug;
		delete globalThis.__originalConsole;
	}

	shouldLog(level) {
		return LEVELS[level] >= LEVELS[this.level];
	}

	format(level, msg, isMention = false) {
		const ts = new Date().toISOString();
		const lbl = this.label ? `[${this.label}] ` : '';
		const body = typeof msg === 'string' ? msg : JSON.stringify(msg);
		const hasMentionId = typeof DISCORD_MENTION_ID !== 'undefined' && DISCORD_MENTION_ID !== null && String(DISCORD_MENTION_ID).trim() !== '';
		const mention = isMention && hasMentionId ? `<@${DISCORD_MENTION_ID}> ` : '';
		return `${mention}${ts} ${level.toUpperCase()}: ${lbl}${body}`;
	}

	log(level, msg, isMention = false, ...meta) {
		if (!LEVELS.hasOwnProperty(level)) level = 'info';
		if (!this.shouldLog(level)) return;
		const formatted = this.format(level, msg, isMention);
		// Use original console methods when available to avoid recursion
		const origConsole = (globalThis && globalThis.__originalConsole) ? globalThis.__originalConsole : console;
		if (level === 'error') origConsole.error(formatted, ...meta);
		else if (level === 'warn') origConsole.warn(formatted, ...meta);
		else if (level === 'debug') (origConsole.debug || origConsole.log)(formatted, ...meta);
		else origConsole.info(formatted, ...meta);
	}

	debug(msg,isMention = false,...meta) { this.log('debug', msg, isMention, ...meta); }
	info(msg, isMention = false, ...meta) { this.log('info', msg, isMention, ...meta); }
	warn(msg, isMention = false, ...meta) { this.log('warn', msg, isMention, ...meta); }
	error(msg, isMention = false, ...meta) { this.log('error', msg, isMention, ...meta); }

	setLevel(level) { if (LEVELS[level] !== undefined) this.level = level; }
	setLabel(label) { this.label = label; }
}

export default Logger;

