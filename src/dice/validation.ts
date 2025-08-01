/**
 * Validation schemas for dice rolling parameters.
 */
import { z } from 'zod';
import { RollDiceParams, RollMultipleParams, ErrorDetail } from './types.js';

/**
 * Schema for validating dice roll parameters.
 */
export const rollDiceSchema = z
	.object({
		dice_count: z
			.number()
			.int()
			.min(1, {
				message: 'Must be at least 1',
			})
			.max(1000, {
				message: 'Cannot exceed 1000',
			}),
		dice_sides: z
			.number()
			.int()
			.min(1, {
				message: 'Must be at least 1',
			})
			.max(100, {
				message: 'Cannot exceed 100',
			}),
		modifier: z.number().optional(),
		keep_highest: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		keep_lowest: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		drop_highest: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		drop_lowest: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		reroll: z.array(z.number().int()).optional(),
		exploding: z.boolean().optional(),
		target_number: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		min_value: z
			.number()
			.int()
			.positive({
				message: 'Must be a positive integer',
			})
			.optional(),
		label: z.string().optional(),
	})
	.refine(
		(data) => {
			// Cannot specify both keep_highest and keep_lowest
			return !(
				data.keep_highest !== undefined && data.keep_lowest !== undefined
			);
		},
		{
			message: 'Cannot specify both keep_highest and keep_lowest',
			path: ['keep_highest', 'keep_lowest'],
		}
	)
	.refine(
		(data) => {
			// Cannot specify both drop_highest and drop_lowest
			return !(
				data.drop_highest !== undefined && data.drop_lowest !== undefined
			);
		},
		{
			message: 'Cannot specify both drop_highest and drop_lowest',
			path: ['drop_highest', 'drop_lowest'],
		}
	)
	.refine(
		(data) => {
			// Cannot specify both keep and drop operations
			const hasKeep = data.keep_highest !== undefined || data.keep_lowest !== undefined;
			const hasDrop = data.drop_highest !== undefined || data.drop_lowest !== undefined;
			return !(hasKeep && hasDrop);
		},
		{
			message: 'Cannot specify both keep and drop operations',
			path: ['keep_highest', 'keep_lowest', 'drop_highest', 'drop_lowest'],
		}
	)
	.refine(
		(data) => {
			// Keep values cannot exceed dice count
			if (
				data.keep_highest !== undefined &&
				data.keep_highest > data.dice_count
			) {
				return false;
			}
			return true;
		},
		{
			message: 'keep_highest cannot exceed dice_count',
			path: ['keep_highest'],
		}
	)
	.refine(
		(data) => {
			// Keep values cannot exceed dice count
			if (
				data.keep_lowest !== undefined &&
				data.keep_lowest > data.dice_count
			) {
				return false;
			}
			return true;
		},
		{
			message: 'keep_lowest cannot exceed dice_count',
			path: ['keep_lowest'],
		}
	)
	.refine(
		(data) => {
			// Drop values cannot exceed dice count
			if (
				data.drop_highest !== undefined &&
				data.drop_highest >= data.dice_count
			) {
				return false;
			}
			return true;
		},
		{
			message: 'drop_highest must be less than dice_count',
			path: ['drop_highest'],
		}
	)
	.refine(
		(data) => {
			// Drop values cannot exceed dice count
			if (
				data.drop_lowest !== undefined &&
				data.drop_lowest >= data.dice_count
			) {
				return false;
			}
			return true;
		},
		{
			message: 'drop_lowest must be less than dice_count',
			path: ['drop_lowest'],
		}
	)
	.refine(
		(data) => {
			// Reroll values must be valid for the die type
			if (
				data.reroll &&
				data.reroll.some((v) => v < 1 || v > data.dice_sides)
			) {
				return false;
			}
			return true;
		},
		{
			message: 'Reroll values must be within range of the die sides',
			path: ['reroll'],
		}
	)
	.refine(
		(data) => {
			// Target number must be valid for the die type
			if (
				data.target_number !== undefined &&
				data.target_number > data.dice_sides
			) {
				return false;
			}
			return true;
		},
		{
			message: 'Target number cannot exceed the number of sides',
			path: ['target_number'],
		}
	)
	.refine(
		(data) => {
			// Min value must be valid for the die type
			if (data.min_value !== undefined && data.min_value > data.dice_sides) {
				return false;
			}
			return true;
		},
		{
			message: 'Minimum value cannot exceed the number of sides',
			path: ['min_value'],
		}
	);

/**
 * Schema for validating multiple dice roll parameters.
 */
export const rollMultipleSchema = z.object({
	rolls: z.array(rollDiceSchema).min(1, {
		message: 'Must include at least one roll configuration',
	}),
	count: z
		.number()
		.int()
		.positive({
			message: 'Must be a positive integer',
		})
		.optional(),
});

/**
 * Validates dice roll parameters and returns a validated object or error details.
 * @param params Parameters to validate
 * @returns Object with success flag and either validated data or error details
 */
export function validateRollDiceParams(
	params: any
):
	| { success: true; data: RollDiceParams }
	| { success: false; errors: ErrorDetail[] } {
	try {
		const validatedData = rollDiceSchema.parse(params);
		return {
			success: true,
			data: validatedData,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorDetails: ErrorDetail[] = error.errors.map((err) => {
				const path = err.path.join('.');
				return {
					parameter: path || 'unknown',
					issue: err.message,
					valid_range: getValidRange(path),
				};
			});

			return {
				success: false,
				errors: errorDetails,
			};
		}

		// Fallback for non-Zod errors
		return {
			success: false,
			errors: [
				{
					parameter: 'unknown',
					issue: 'An unexpected validation error occurred',
				},
			],
		};
	}
}

/**
 * Validates multiple dice roll parameters and returns a validated object or error details.
 * @param params Parameters to validate
 * @returns Object with success flag and either validated data or error details
 */
export function validateRollMultipleParams(
	params: any
):
	| { success: true; data: RollMultipleParams }
	| { success: false; errors: ErrorDetail[] } {
	try {
		const validatedData = rollMultipleSchema.parse(params);
		return {
			success: true,
			data: validatedData,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorDetails: ErrorDetail[] = error.errors.map((err) => {
				const path = err.path.join('.');
				return {
					parameter: path || 'unknown',
					issue: err.message,
					valid_range: getValidRange(path),
				};
			});

			return {
				success: false,
				errors: errorDetails,
			};
		}

		// Fallback for non-Zod errors
		return {
			success: false,
			errors: [
				{
					parameter: 'unknown',
					issue: 'An unexpected validation error occurred',
				},
			],
		};
	}
}

/**
 * Gets the valid range for a parameter based on its name.
 * @param paramName Name of the parameter
 * @returns String representation of valid range, or undefined if not applicable
 */
function getValidRange(paramName: string): string | undefined {
	if (paramName.includes('dice_count')) {
		return '1-1000';
	} else if (paramName.includes('dice_sides')) {
		return '1-100';
	}
	return undefined;
}
