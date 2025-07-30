/**
 * Minimal logging utilities for the dice rolling server.
 * All logs go to stderr to avoid interfering with stdout MCP communication.
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
		: LogLevel.INFO, // Changed default to INFO for better visibility

	// Include timestamp in logs
	includeTimestamp: true,
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
 * Log a message to stderr (all logs go to stderr to avoid interfering with MCP stdout)
 * @param level Log level
 * @param message Message to log
 * @param args Additional context
 */
function log(level: LogLevel, message: string, ...args: any[]): void {
	if (shouldLog(level)) {
		const formattedMessage = formatLogMessage(level, message, args);
		console.error(formattedMessage);
	}
}

/**
 * Log an error message
 * @param message Error message
 * @param args Additional context
 */
export function error(message: string, ...args: any[]): void {
	log(LogLevel.ERROR, message, ...args);
}

/**
 * Log a warning message
 * @param message Warning message
 * @param args Additional context
 */
export function warn(message: string, ...args: any[]): void {
	log(LogLevel.WARN, message, ...args);
}

/**
 * Log an info message
 * @param message Info message
 * @param args Additional context
 */
export function info(message: string, ...args: any[]): void {
	log(LogLevel.INFO, message, ...args);
}

/**
 * Log a debug message
 * @param message Debug message
 * @param args Additional context
 */
export function debug(message: string, ...args: any[]): void {
	log(LogLevel.DEBUG, message, ...args);
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
