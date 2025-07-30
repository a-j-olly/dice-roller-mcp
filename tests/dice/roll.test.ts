/**
 * Tests for the dice rolling functions.
 */
import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest';
import {
	rollSingleDie,
	rollDice,
	keepHighestDice,
	keepLowestDice,
	dropHighestDice,
	dropLowestDice,
	rerollDice,
	explodeDice,
	applyMinValue,
	countSuccesses,
	generateOperation,
	generateDescription,
} from '../../src/dice/roll.js';
import { DieResult, RollDiceParams } from '../../src/dice/types.js';

// Mock Math.random to make tests deterministic
const originalRandom = Math.random;

beforeEach(() => {
	// Reset all mocks
	vi.resetAllMocks();
});

afterAll(() => {
	// Restore original Math.random
	Math.random = originalRandom;
});

describe('rollSingleDie', () => {
	test('returns a number between 1 and sides (inclusive)', () => {
		for (let sides = 2; sides <= 20; sides++) {
			// Mock random to return specific values
			Math.random = vi.fn(() => 0) as unknown as () => number; // Will return 1
			expect(rollSingleDie(sides)).toBe(1);

			Math.random = vi.fn(() => 0.999) as unknown as () => number; // Will return 'sides'
			expect(rollSingleDie(sides)).toBe(sides);

			// Test with a random value in the middle
			Math.random = vi.fn(() => 0.5) as unknown as () => number;
			const result = rollSingleDie(sides);
			expect(result).toBeGreaterThanOrEqual(1);
			expect(result).toBeLessThanOrEqual(sides);
		}
	});
});

describe('rollDice', () => {
	test('basic roll without modifiers', () => {
		// Mock to get 3, 5, 2 for three d6
		const mockValues = [2 / 6, 4 / 6, 1 / 6]; // will result in [3, 5, 2]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
		};

		const result = rollDice(params);

		expect(result.dice.length).toBe(3);
		expect(result.dice[0].rolls).toEqual([3]);
		expect(result.dice[1].rolls).toEqual([5]);
		expect(result.dice[2].rolls).toEqual([2]);
		expect(result.total).toBe(10); // 3 + 5 + 2
		expect(result.operation).toBe('3d6');
		expect(result.description).toBe('Rolled 3d6');
	});

	test('roll with modifier', () => {
		const mockValues = [2 / 6, 4 / 6, 1 / 6]; // will result in [3, 5, 2]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
			modifier: 5,
		};

		const result = rollDice(params);

		expect(result.total).toBe(15); // 3 + 5 + 2 + 5
		expect(result.operation).toBe('3d6+5');
		expect(result.description).toBe('Rolled 3d6, adding 5');
	});

	test('keep highest dice', () => {
		const mockValues = [2 / 6, 4 / 6, 1 / 6, 5 / 6]; // will result in [3, 5, 2, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			keep_highest: 2,
		};

		const result = rollDice(params);

		// Kept dice should be 5 and 6 (5 from index 1, 6 from index 3)
		expect(result.dice.filter((d) => d.kept).length).toBe(2);
		expect(result.dice[1].kept).toBe(true); // 5
		expect(result.dice[3].kept).toBe(true); // 6
		expect(result.total).toBe(11); // 5 + 6
		expect(result.operation).toBe('4d6kh2');
		expect(result.description).toBe('Rolled 4d6, keeping highest 2');
	});

	test('keep lowest dice', () => {
		const mockValues = [2 / 6, 4 / 6, 1 / 6, 5 / 6]; // will result in [3, 5, 2, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			keep_lowest: 2,
		};

		const result = rollDice(params);

		// Kept dice should be 2 and 3 (2 from index 2, 3 from index 0)
		expect(result.dice.filter((d) => d.kept).length).toBe(2);
		expect(result.dice[0].kept).toBe(true); // 3
		expect(result.dice[2].kept).toBe(true); // 2
		expect(result.total).toBe(5); // 3 + 2
		expect(result.operation).toBe('4d6kl2');
		expect(result.description).toBe('Rolled 4d6, keeping lowest 2');
	});

	test('reroll specific values', () => {
		// Mock to get initial rolls of [1, 3, 1], then rerolls of [4, 6]
		const mockValues = [0, 2 / 6, 0, 3 / 6, 5 / 6];
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
			reroll: [1],
		};

		const result = rollDice(params);

		// First and third die should have been rerolled
		expect(result.dice[0].rolls).toEqual([1, 4]);
		expect(result.dice[0].special).toBe('rerolled');
		expect(result.dice[1].rolls).toEqual([3]);
		expect(result.dice[1].special).toBeNull();
		expect(result.dice[2].rolls).toEqual([1, 6]);
		expect(result.dice[2].special).toBe('rerolled');

		// Die values should be the last roll of each die (4, 3, 6)
		expect(result.dice[0].value).toBe(4);
		expect(result.dice[1].value).toBe(3);
		expect(result.dice[2].value).toBe(6);

		expect(result.total).toBe(13); // 4 + 3 + 6
		expect(result.operation).toBe('3d6r1');
		expect(result.description).toBe('Rolled 3d6, rerolling 1s');
	});

	test('exploding dice', () => {
		// Mock to get initial rolls of [6, 3, 6], then explosion rolls of [6, 2, 4]
		const mockValues = [5 / 6, 2 / 6, 5 / 6, 5 / 6, 1 / 6, 3 / 6];
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
			exploding: true,
		};

		const result = rollDice(params);

		// First die should have exploded twice (6 -> 6 -> 2)
		expect(result.dice[0].rolls).toEqual([6, 6, 2]);
		expect(result.dice[0].special).toBe('exploded');
		expect(result.dice[0].value).toBe(14); // Sum of all rolls (6+6+2)

		// Second die should not explode (3)
		expect(result.dice[1].rolls).toEqual([3]);
		expect(result.dice[1].special).toBeNull();
		expect(result.dice[1].value).toBe(3);

		// Third die should explode once (6 -> 4)
		expect(result.dice[2].rolls).toEqual([6, 4]);
		expect(result.dice[2].special).toBe('exploded');
		expect(result.dice[2].value).toBe(10); // Sum of all rolls (6+4)

		// Total should be sum of all rolls: (6+6+2) + 3 + (6+4) = 27
		expect(result.total).toBe(27);
		expect(result.operation).toBe('3d6!');
		expect(result.description).toBe('Rolled 3d6, exploding on 6s');
	});

	test('minimum value for dice', () => {
		const mockValues = [0, 1 / 6, 5 / 6]; // will result in [1, 2, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 3,
			dice_sides: 6,
			min_value: 3,
		};

		const result = rollDice(params);

		// First and second dice should have minimum value applied
		expect(result.dice[0].rolls).toEqual([1]);
		expect(result.dice[0].value).toBe(3); // Minimum applied
		expect(result.dice[0].special).toBe('min-3');

		expect(result.dice[1].rolls).toEqual([2]);
		expect(result.dice[1].value).toBe(3); // Minimum applied
		expect(result.dice[1].special).toBe('min-3');

		expect(result.dice[2].rolls).toEqual([6]);
		expect(result.dice[2].value).toBe(6); // No minimum needed
		expect(result.dice[2].special).toBeNull();

		expect(result.total).toBe(12); // 3 + 3 + 6
		expect(result.operation).toBe('3d6min3');
		expect(result.description).toBe('Rolled 3d6, minimum value 3');
	});

	test('target number counting', () => {
		const mockValues = [0, 2 / 6, 3 / 6, 5 / 6]; // will result in [1, 3, 4, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			target_number: 4,
		};

		const result = rollDice(params);

		expect(result.successes).toBe(2); // 4 and 6 are successes
		expect(result.total_dice).toBe(4);
		expect(result.total).toBe(2); // 2 successes
		expect(result.operation).toBe('4d6>=4');
		expect(result.description).toBe('Rolled 4d6, counting successes >= 4');
	});

	test('drop highest dice', () => {
		const mockValues = [2 / 6, 4 / 6, 1 / 6, 5 / 6]; // will result in [3, 5, 2, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			drop_highest: 2,
		};

		const result = rollDice(params);

		// Dropped dice should be 5 and 6 (highest values)
		// Kept dice should be 2 and 3 (lowest values)
		expect(result.dice.filter((d) => d.kept).length).toBe(2);
		expect(result.dice[0].kept).toBe(true); // 3
		expect(result.dice[1].kept).toBe(false); // 5 (dropped)
		expect(result.dice[2].kept).toBe(true); // 2
		expect(result.dice[3].kept).toBe(false); // 6 (dropped)
		expect(result.total).toBe(5); // 3 + 2
		expect(result.operation).toBe('4d6dh2');
		expect(result.description).toBe('Rolled 4d6, dropping highest 2');
	});

	test('drop lowest dice', () => {
		const mockValues = [2 / 6, 4 / 6, 1 / 6, 5 / 6]; // will result in [3, 5, 2, 6]
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			drop_lowest: 2,
		};

		const result = rollDice(params);

		// Dropped dice should be 2 and 3 (lowest values)
		// Kept dice should be 5 and 6 (highest values)
		expect(result.dice.filter((d) => d.kept).length).toBe(2);
		expect(result.dice[0].kept).toBe(false); // 3 (dropped)
		expect(result.dice[1].kept).toBe(true); // 5
		expect(result.dice[2].kept).toBe(false); // 2 (dropped)
		expect(result.dice[3].kept).toBe(true); // 6
		expect(result.total).toBe(11); // 5 + 6
		expect(result.operation).toBe('4d6dl2');
		expect(result.description).toBe('Rolled 4d6, dropping lowest 2');
	});

	test('combines multiple modifiers correctly', () => {
		// Mock to get initial rolls of [1, 3, 1, 5], then rerolls of [2, 6]
		const mockValues = [0, 2 / 6, 0, 4 / 6, 1 / 6, 5 / 6];
		let currentIndex = 0;
		Math.random = vi.fn(
			() => mockValues[currentIndex++]
		) as unknown as () => number;

		const params: RollDiceParams = {
			dice_count: 4,
			dice_sides: 6,
			reroll: [1],
			keep_highest: 2,
			modifier: 3,
		};

		const result = rollDice(params);

		// Dice should be [1→2, 3, 1→6, 5] with 6 and 5 kept (the highest)
		expect(result.dice[0].rolls).toEqual([1, 2]);
		expect(result.dice[0].special).toBe('rerolled');
		expect(result.dice[0].value).toBe(2);
		expect(result.dice[0].kept).toBe(false);

		expect(result.dice[1].rolls).toEqual([3]);
		expect(result.dice[1].value).toBe(3);
		expect(result.dice[1].kept).toBe(false);

		expect(result.dice[2].rolls).toEqual([1, 6]);
		expect(result.dice[2].special).toBe('rerolled');
		expect(result.dice[2].value).toBe(6);
		expect(result.dice[2].kept).toBe(true);

		expect(result.dice[3].rolls).toEqual([5]);
		expect(result.dice[3].value).toBe(5);
		expect(result.dice[3].kept).toBe(true);

		// Kept dice should be 5 and 6 (rerolled from 1)
		expect(result.dice.filter((d) => d.kept).length).toBe(2);
		expect(result.total).toBe(14); // 5 + 6 + 3
		expect(result.operation).toBe('4d6kh2r1+3');
		expect(result.description).toBe(
			'Rolled 4d6, keeping highest 2, rerolling 1s, adding 3'
		);
	});
});

describe('utility functions', () => {
	test('generateOperation creates correct notation', () => {
		expect(generateOperation({ dice_count: 3, dice_sides: 6 })).toBe('3d6');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, modifier: 2 })
		).toBe('3d6+2');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, modifier: -2 })
		).toBe('3d6-2');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, keep_highest: 2 })
		).toBe('3d6kh2');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, keep_lowest: 2 })
		).toBe('3d6kl2');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, drop_highest: 1 })
		).toBe('3d6dh1');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, drop_lowest: 1 })
		).toBe('3d6dl1');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, reroll: [1] })
		).toBe('3d6r1');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, exploding: true })
		).toBe('3d6!');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, min_value: 2 })
		).toBe('3d6min2');
		expect(
			generateOperation({ dice_count: 3, dice_sides: 6, target_number: 4 })
		).toBe('3d6>=4');

		// Combined options
		expect(
			generateOperation({
				dice_count: 4,
				dice_sides: 8,
				keep_highest: 3,
				exploding: true,
				modifier: 5,
			})
		).toBe('4d8kh3!+5');
	});

	test('generateDescription creates readable text', () => {
		expect(generateDescription({ dice_count: 3, dice_sides: 6 })).toBe(
			'Rolled 3d6'
		);

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, modifier: 2 })
		).toBe('Rolled 3d6, adding 2');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, modifier: -2 })
		).toBe('Rolled 3d6, subtracting 2');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, keep_highest: 2 })
		).toBe('Rolled 3d6, keeping highest 2');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, keep_lowest: 2 })
		).toBe('Rolled 3d6, keeping lowest 2');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, drop_highest: 1 })
		).toBe('Rolled 3d6, dropping highest 1');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, drop_lowest: 1 })
		).toBe('Rolled 3d6, dropping lowest 1');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, reroll: [1] })
		).toBe('Rolled 3d6, rerolling 1s');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, reroll: [1, 2] })
		).toBe('Rolled 3d6, rerolling 1, 2s');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, exploding: true })
		).toBe('Rolled 3d6, exploding on 6s');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, min_value: 2 })
		).toBe('Rolled 3d6, minimum value 2');

		expect(
			generateDescription({ dice_count: 3, dice_sides: 6, target_number: 4 })
		).toBe('Rolled 3d6, counting successes >= 4');

		// Combined options
		expect(
			generateDescription({
				dice_count: 4,
				dice_sides: 8,
				keep_highest: 3,
				exploding: true,
				modifier: 5,
			})
		).toBe('Rolled 4d8, keeping highest 3, exploding on 8s, adding 5');
	});
});

describe('helper functions', () => {
	test('keepHighestDice correctly filters dice', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [5], value: 5, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 4, sides: 6, rolls: [4], value: 4, kept: true, special: null },
		];

		const result = keepHighestDice(dice, 2);

		expect(result[0].kept).toBe(false); // 2
		expect(result[1].kept).toBe(true); // 5
		expect(result[2].kept).toBe(false); // 1
		expect(result[3].kept).toBe(true); // 4
	});

	test('keepLowestDice correctly filters dice', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [5], value: 5, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 4, sides: 6, rolls: [4], value: 4, kept: true, special: null },
		];

		const result = keepLowestDice(dice, 2);

		expect(result[0].kept).toBe(true); // 2
		expect(result[1].kept).toBe(false); // 5
		expect(result[2].kept).toBe(true); // 1
		expect(result[3].kept).toBe(false); // 4
	});

	test('countSuccesses tallies dice meeting target', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [5], value: 5, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 4, sides: 6, rolls: [4], value: 4, kept: true, special: null },
		];

		expect(countSuccesses(dice, 4)).toBe(2); // 5 and 4 meet or exceed target
		expect(countSuccesses(dice, 3)).toBe(2); // 5 and 4 meet or exceed target (only two values ≥ 3)
		expect(countSuccesses(dice, 6)).toBe(0); // No dice meet or exceed target
	});

	test('rerollDice adds additional rolls for specified values', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
		];

		// Mock rollSingleDie to return 3 and 4 for the rerolls
		Math.random = vi
			.fn()
			.mockReturnValueOnce(2 / 6) // 3
			.mockReturnValueOnce(3 / 6) as unknown as () => number; // 4

		const result = rerollDice(dice, [1]);

		expect(result[0].rolls).toEqual([1, 3]);
		expect(result[0].special).toBe('rerolled');
		expect(result[1].rolls).toEqual([2]); // No reroll
		expect(result[1].special).toBeNull();
		expect(result[2].rolls).toEqual([1, 4]);
		expect(result[2].special).toBe('rerolled');
	});

	test('explodeDice continues rolling on maximum values', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [6], value: 6, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [3], value: 3, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [6], value: 6, kept: true, special: null },
		];

		// Mock rollSingleDie to return 6, 2 for first die and 4 for third die
		Math.random = vi
			.fn()
			.mockReturnValueOnce(5 / 6) // 6
			.mockReturnValueOnce(1 / 6) // 2
			.mockReturnValueOnce(3 / 6) as unknown as () => number; // 4

		const result = explodeDice(dice);

		expect(result[0].rolls).toEqual([6, 6, 2]);
		expect(result[0].special).toBe('exploded');
		expect(result[1].rolls).toEqual([3]); // No explosion
		expect(result[1].special).toBeNull();
		expect(result[2].rolls).toEqual([6, 4]);
		expect(result[2].special).toBe('exploded');
	});

	test('applyMinValue enforces minimum die values', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [3], value: 3, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [2], value: 2, kept: true, special: null },
		];

		const result = applyMinValue(dice, 2);

		expect(result[0].value).toBe(2); // Minimum applied
		expect(result[0].special).toBe('min-2');
		expect(result[1].value).toBe(3); // No change needed
		expect(result[1].special).toBeNull();
		expect(result[2].value).toBe(2); // No change needed (already 2)
		expect(result[2].special).toBeNull();
	});

	test('dropHighestDice correctly filters dice', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [5], value: 5, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 4, sides: 6, rolls: [4], value: 4, kept: true, special: null },
		];

		const result = dropHighestDice(dice, 2);

		expect(result[0].kept).toBe(true); // 2 (kept)
		expect(result[1].kept).toBe(false); // 5 (dropped)
		expect(result[2].kept).toBe(true); // 1 (kept)
		expect(result[3].kept).toBe(false); // 4 (dropped)
	});

	test('dropLowestDice correctly filters dice', () => {
		const dice: DieResult[] = [
			{ die: 1, sides: 6, rolls: [2], value: 2, kept: true, special: null },
			{ die: 2, sides: 6, rolls: [5], value: 5, kept: true, special: null },
			{ die: 3, sides: 6, rolls: [1], value: 1, kept: true, special: null },
			{ die: 4, sides: 6, rolls: [4], value: 4, kept: true, special: null },
		];

		const result = dropLowestDice(dice, 2);

		expect(result[0].kept).toBe(false); // 2 (dropped)
		expect(result[1].kept).toBe(true); // 5 (kept)
		expect(result[2].kept).toBe(false); // 1 (dropped)
		expect(result[3].kept).toBe(true); // 4 (kept)
	});
});
