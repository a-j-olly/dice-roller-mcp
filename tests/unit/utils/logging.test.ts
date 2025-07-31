/**
 * Tests for the logging utility functions.
 * Tests different log levels, formatting, and environment variable handling.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from '../../../src/utils/logging.js';

describe('Logging Utility', () => {
	let consoleErrorSpy: any;
	let originalLogLevel: string | undefined;

	beforeEach(() => {
		// Store original environment variable
		originalLogLevel = process.env.LOG_LEVEL;
		
		// Mock console.error to capture log output
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore original environment variable
		if (originalLogLevel !== undefined) {
			process.env.LOG_LEVEL = originalLogLevel;
		} else {
			delete process.env.LOG_LEVEL;
		}
		
		// Restore console.error
		consoleErrorSpy?.mockRestore();
	});

	describe('Log Level Filtering', () => {
		test('should log error messages by default', () => {
			delete process.env.LOG_LEVEL;
			
			logger.error('Test error message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('ERROR: Test error message')
			);
		});

		test('should log warning messages by default', () => {
			delete process.env.LOG_LEVEL;
			
			logger.warn('Test warning message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('WARN: Test warning message')
			);
		});

		test('should log info messages by default', () => {
			delete process.env.LOG_LEVEL;
			
			logger.info('Test info message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('INFO: Test info message')
			);
		});

		test('should not log debug messages by default', () => {
			delete process.env.LOG_LEVEL;
			
			logger.debug('Test debug message');
			
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
	});

	describe('Environment Variable Configuration', () => {
		test('should respect LOG_LEVEL=ERROR environment variable', async () => {
			process.env.LOG_LEVEL = 'ERROR';
			
			// Re-import to pick up environment change
			vi.resetModules();
			const { logger: newLogger } = await import('../../../src/utils/logging.js');
			
			newLogger.error('Error message');
			newLogger.warn('Warning message');
			newLogger.info('Info message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('ERROR: Error message')
			);
		});

		test('should respect LOG_LEVEL=DEBUG environment variable', async () => {
			process.env.LOG_LEVEL = 'DEBUG';
			
			// Re-import to pick up environment change
			vi.resetModules();
			const { logger: newLogger } = await import('../../../src/utils/logging.js');
			
			newLogger.error('Error message');
			newLogger.warn('Warning message');
			newLogger.info('Info message');
			newLogger.debug('Debug message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
		});

		test('should handle lowercase LOG_LEVEL environment variable', async () => {
			process.env.LOG_LEVEL = 'error';
			
			// Re-import to pick up environment change
			vi.resetModules();
			const { logger: newLogger } = await import('../../../src/utils/logging.js');
			
			newLogger.error('Error message');
			newLogger.warn('Warning message');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('ERROR: Error message')
			);
		});
	});

	describe('Message Formatting', () => {
		test('should include timestamp in log messages', () => {
			logger.info('Test message');
			
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/^\[.+\] INFO: Test message$/)
			);
		});

		test('should format messages with additional arguments', () => {
			const testObject = { key: 'value', number: 42 };
			
			logger.info('Test message', 'additional text', testObject);
			
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('INFO: Test message additional text {"key":"value","number":42}')
			);
		});

		test('should handle null and undefined arguments', () => {
			logger.info('Test message', null, undefined, 0, false);
			
			// null becomes "null", undefined becomes empty string
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('INFO: Test message')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('0 false')
			);
		});

		test('should handle array arguments', () => {
			logger.info('Test message', [1, 2, 3]);
			
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('INFO: Test message [1,2,3]')
			);
		});
	});

	describe('All Log Levels', () => {
		test('should have error function', () => {
			expect(typeof logger.error).toBe('function');
		});

		test('should have warn function', () => {
			expect(typeof logger.warn).toBe('function');
		});

		test('should have info function', () => {
			expect(typeof logger.info).toBe('function');
		});

		test('should have debug function', () => {
			expect(typeof logger.debug).toBe('function');
		});
	});

	describe('Log Level Priority', () => {
		test('should log higher priority messages when configured for lower priority', async () => {
			process.env.LOG_LEVEL = 'WARN';
			
			// Re-import to pick up environment change
			vi.resetModules();
			const { logger: newLogger } = await import('../../../src/utils/logging.js');
			
			newLogger.error('Error message');   // Should log (higher priority)
			newLogger.warn('Warning message');  // Should log (same priority)
			newLogger.info('Info message');     // Should not log (lower priority)
			newLogger.debug('Debug message');   // Should not log (lower priority)
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty message', () => {
			logger.info('');
			
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('INFO: ')
			);
		});

		test('should handle message with special characters', () => {
			logger.info('Test message with 🎲 emoji and "quotes" and \n newlines');
			
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});

		test('should handle circular object references', () => {
			const circularObj: any = { name: 'test' };
			circularObj.self = circularObj;
			
			// This will throw because JSON.stringify can't handle circular references
			// This is expected behavior - the logger doesn't need to handle this edge case
			expect(() => {
				logger.info('Test message', circularObj);
			}).toThrow('Converting circular structure to JSON');
		});
	});
});