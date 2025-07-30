/**
 * Minimal logging utilities for the dice rolling server.
 * Only logs errors and critical issues to keep logs clean.
 */

/**
 * Log levels enum
 */
export enum LogLevel {
	ERROR = 'ERROR',
	WARN = 'WARN',
	INFO = 'INFO',
	DEBUG = 'DEBUG',
}

/**
 * Logging configuration
 */
const config = {
	// Log errors, warnings and info by default
	minLevel: process.env.LOG_LEVEL
		? (process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel)
		: LogLevel.INFO,

	// Include timestamp in logs
	includeTimestamp: true,

	// Output to stderr for errors and warnings, stdout for others
	useStderr: true,
};

/**
 * Map of log levels to their priority (lower number = higher priority)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	[LogLevel.ERROR]: 0,
	[LogLevel.WARN]: 1,
	[LogLevel.INFO]: 2,
	[LogLevel.DEBUG]: 3,
};

/**
 * Check if a log level should be logged based on configuration
 * @param level The log level to check
 * @returns Boolean indicating if this level should be logged
 */
function shouldLog(level: LogLevel): boolean {
	const configuredLevel = (config.minLevel as LogLevel) || LogLevel.ERROR;
	return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[configuredLevel];
}

/**
 * Format a log message with timestamp and level
 * @param level Log level
 * @param message Message to log
 * @param args Additional arguments
 * @returns Formatted log message
 */
function formatLogMessage(
	level: LogLevel,
	message: string,
	args: any[]
): string {
	const timestamp = config.includeTimestamp
		? `[${new Date().toISOString()}] `
		: '';
	const formattedMessage = `${timestamp}${level}: ${message}`;

	// If additional context was provided, append it
	if (args.length > 0) {
		return `${formattedMessage} ${args
			.map((arg) =>
				typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : arg
			)
			.join(' ')}`;
	}

	return formattedMessage;
}

/**
 * Log an error message
 * @param message Error message
 * @param args Additional context
 */
export function error(message: string, ...args: any[]): void {
	if (shouldLog(LogLevel.ERROR)) {
		const formattedMessage = formatLogMessage(LogLevel.ERROR, message, args);
		console.error(formattedMessage);
	}
}

/**
 * Log a warning message
 * @param message Warning message
 * @param args Additional context
 */
export function warn(message: string, ...args: any[]): void {
	if (shouldLog(LogLevel.WARN)) {
		const formattedMessage = formatLogMessage(LogLevel.WARN, message, args);
		if (config.useStderr) {
			console.error(formattedMessage);
		} else {
			console.warn(formattedMessage);
		}
	}
}

/**
 * Log an info message (disabled by default)
 * @param message Info message
 * @param args Additional context
 */
export function info(message: string, ...args: any[]): void {
	if (shouldLog(LogLevel.INFO)) {
		const formattedMessage = formatLogMessage(LogLevel.INFO, message, args);
		console.info(formattedMessage);
	}
}

/**
 * Log a debug message (disabled by default)
 * @param message Debug message
 * @param args Additional context
 */
export function debug(message: string, ...args: any[]): void {
	if (shouldLog(LogLevel.DEBUG)) {
		const formattedMessage = formatLogMessage(LogLevel.DEBUG, message, args);
		console.debug(formattedMessage);
	}
}

/**
 * Logger object for convenience
 */
export const logger = {
	error,
	warn,
	info,
	debug,
};
