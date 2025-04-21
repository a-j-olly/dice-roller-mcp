import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true, // Makes test functions (describe, it, etc.) globally available
		environment: 'node', // Sets the test environment to Node.js
		include: ['tests/**/*.test.ts'], // Test file patterns to include
		exclude: ['node_modules', 'build'], // Directories to exclude
		reporters: ['default'], // Use the default test reporter
		coverage: {
			reporter: ['text', 'html'], // Coverage report types
			exclude: ['node_modules/'], // Exclude node_modules from coverage
		},
		testTimeout: 10000, // Test timeout in milliseconds
	},
	resolve: {
		alias: {
			// If you need path aliases, define them here
		},
	},
});
