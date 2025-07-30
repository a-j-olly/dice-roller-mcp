/**
 * Tests for the validation functions.
 */
import { describe, test, expect } from 'vitest';
import {
	rollDiceSchema,
	rollMultipleSchema,
	validateRollDiceParams,
	validateRollMultipleParams,
} from '../../src/dice/validation.js';
import { RollDiceParams, RollMultipleParams } from '../../src/dice/types.js';

describe('rollDiceSchema', () => {
	test('validates a valid basic roll', () => {
		const validParams: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
		};

		const result = rollDiceSchema.safeParse(validParams);
		expect(result.success).toBe(true);
	});

	test('validates a valid complex roll', () => {
		const validParams: RollDiceParams = {
			dice_count: 4,
			dice_sides: 20,
			modifier: 5,
			keep_highest: 2,
			reroll: [1, 2],
			exploding: true,
			min_value: 3,
		};

		const result = rollDiceSchema.safeParse(validParams);
		expect(result.success).toBe(true);
	});

	test('rejects dice_count below minimum', () => {
		const invalidParams = {
			dice_count: 0,
			dice_sides: 6,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects dice_count above maximum', () => {
		const invalidParams = {
			dice_count: 1001,
			dice_sides: 6,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects dice_sides below minimum', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 0,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects dice_sides above maximum', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 101,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects both keep_highest and keep_lowest', () => {
		const invalidParams = {
			dice_count: 4,
			dice_sides: 6,
			keep_highest: 2,
			keep_lowest: 2,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects both drop_highest and drop_lowest', () => {
		const invalidParams = {
			dice_count: 4,
			dice_sides: 6,
			drop_highest: 1,
			drop_lowest: 1,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects both keep and drop operations', () => {
		const invalidParams = {
			dice_count: 4,
			dice_sides: 6,
			keep_highest: 2,
			drop_lowest: 1,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects keep_highest greater than dice_count', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 6,
			keep_highest: 4,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects drop_highest greater than or equal to dice_count', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 6,
			drop_highest: 3,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects drop_lowest greater than or equal to dice_count', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 6,
			drop_lowest: 4,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects target_number greater than dice_sides', () => {
		const invalidParams = {
			dice_count: 4,
			dice_sides: 6,
			target_number: 7,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects min_value greater than dice_sides', () => {
		const invalidParams = {
			dice_count: 4,
			dice_sides: 6,
			min_value: 7,
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects invalid reroll values', () => {
		const invalidParams = {
			dice_count: 3,
			dice_sides: 6,
			reroll: [0, 7],
		};

		const result = rollDiceSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});
});

describe('rollMultipleSchema', () => {
	test('validates valid multiple roll params', () => {
		const validParams: RollMultipleParams = {
			rolls: [
				{ dice_count: 1, dice_sides: 20 },
				{ dice_count: 3, dice_sides: 6, keep_highest: 2 },
			],
			count: 3,
		};

		const result = rollMultipleSchema.safeParse(validParams);
		expect(result.success).toBe(true);
	});

	test('rejects empty rolls array', () => {
		const invalidParams = {
			rolls: [],
			count: 2,
		};

		const result = rollMultipleSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects negative count', () => {
		const invalidParams = {
			rolls: [{ dice_count: 1, dice_sides: 6 }],
			count: -1,
		};

		const result = rollMultipleSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});

	test('rejects invalid roll in rolls array', () => {
		const invalidParams = {
			rolls: [
				{ dice_count: 1, dice_sides: 20 },
				{ dice_count: 1001, dice_sides: 6 },
			],
		};

		const result = rollMultipleSchema.safeParse(invalidParams);
		expect(result.success).toBe(false);
	});
});

describe('validateRollDiceParams', () => {
	test('returns success and validated data for valid params', () => {
		const validParams = {
			dice_count: 3,
			dice_sides: 6,
			modifier: 2,
		};

		const result = validateRollDiceParams(validParams);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(validParams);
		}
	});

	test('returns error details for invalid params', () => {
		const invalidParams = {
			dice_count: 0,
			dice_sides: 101,
		};

		const result = validateRollDiceParams(invalidParams);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0].parameter).toMatch(/dice_count|dice_sides/);
		}
	});

	test('includes valid_range in error details', () => {
		const invalidParams = {
			dice_count: 1001,
			dice_sides: 6,
		};

		const result = validateRollDiceParams(invalidParams);
		expect(result.success).toBe(false);
		if (!result.success) {
			const diceCountError = result.errors.find((err) =>
				err.parameter.includes('dice_count')
			);
			expect(diceCountError?.valid_range).toBe('1-1000');
		}
	});
});

describe('validateRollMultipleParams', () => {
	test('returns success and validated data for valid params', () => {
		const validParams = {
			rolls: [
				{ dice_count: 1, dice_sides: 20 },
				{ dice_count: 3, dice_sides: 6 },
			],
			count: 2,
		};

		const result = validateRollMultipleParams(validParams);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(validParams);
		}
	});

	test('returns error details for invalid params', () => {
		const invalidParams = {
			rolls: [],
		};

		const result = validateRollMultipleParams(invalidParams);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	test('handles nested validation errors', () => {
		const invalidParams = {
			rolls: [
				{ dice_count: 1, dice_sides: 20 },
				{ dice_count: 0, dice_sides: 6 },
			],
		};

		const result = validateRollMultipleParams(invalidParams);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some((err) => err.parameter.includes('dice_count'))
			).toBe(true);
		}
	});
});
