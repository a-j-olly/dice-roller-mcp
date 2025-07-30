/**
 * Types for the dice rolling functionality.
 */

/**
 * Parameters for a dice roll.
 */
export interface RollDiceParams {
	dice_count: number; // Number of dice to roll (1-1000)
	dice_sides: number; // Number of sides on each die (1-100)
	modifier?: number; // Number to add/subtract from final sum
	keep_highest?: number; // Number of highest dice to keep
	keep_lowest?: number; // Number of lowest dice to keep
	reroll?: number[]; // Array of values that trigger a single reroll
	exploding?: boolean; // Whether dice explode on maximum value
	target_number?: number; // If set, count successes >= this number instead of sum
	min_value?: number; // Minimum value for any individual die
}

/**
 * Parameters for multiple dice rolls.
 */
export interface RollMultipleParams {
	rolls: RollDiceParams[]; // Array of dice roll configurations
	count?: number; // Number of times to repeat the entire set
}

/**
 * Result for a single die.
 */
export interface DieResult {
	die: number; // Die number in sequence
	sides: number; // Number of sides on this die
	rolls: number[]; // All rolls of this die (including rerolls)
	value: number; // Final value used in calculation
	kept: boolean; // Whether this die was kept in final calculation
	special: string | null; // Any special flags (exploded, rerolled, etc.)
}

/**
 * Result for a complete dice roll.
 */
export interface RollResult {
	total: number; // The final calculated total (for summed dice)
	successes?: number; // Number of successful dice (only for target number rolls)
	total_dice?: number; // Total dice rolled (only for target number rolls)
	dice: DieResult[]; // Details of individual dice
	operation: string; // The operation performed in standard notation
	description: string; // Human-readable description of the roll
}

/**
 * Complete response for a dice roll.
 */
export interface RollResponse {
	result: RollResult;
	metadata: {
		parameters: RollDiceParams;
		timestamp: string;
	};
}

/**
 * Complete response for multiple dice rolls.
 */
export interface RollMultipleResponse {
	results: RollResult[];
	metadata: {
		parameters: RollMultipleParams;
		timestamp: string;
	};
}

/**
 * Error detail for parameter validation failures.
 */
export interface ErrorDetail {
	parameter: string;
	issue: string;
	valid_range?: string;
}

/**
 * Error response format.
 */
export interface ErrorResponse {
	error: {
		message: string;
		details: ErrorDetail[];
	};
}

/**
 * MCP tool response content.
 */
export interface McpToolContent {
	type: 'text';
	text: string;
}

/**
 * MCP tool response result.
 */
export interface McpToolResult {
	content: McpToolContent[];
}

/**
 * MCP error response.
 */
export interface McpError {
	code: number;
	message: string;
}

/**
 * MCP JSON-RPC response.
 */
export interface McpResponse {
	result?: McpToolResult;
	error?: McpError;
	jsonrpc: '2.0';
	id: number;
}
