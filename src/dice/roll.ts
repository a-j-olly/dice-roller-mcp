/**
 * Core dice rolling functions for the MCP server.
 *
 * The dice rolling system supports several operations:
 * - Basic dice rolling (e.g., 3d6)
 * - Keep highest/lowest dice (e.g., 4d6 keep highest 3)
 * - Rerolling specific values (e.g., 3d6 reroll 1s)
 * - Exploding dice (e.g., 2d6 exploding)
 * - Target number counting (e.g., 5d10 count 8+)
 * - Minimum die value (e.g., 4d6 minimum 2)
 *
 * Each operation has specific rules for how the final die value is calculated:
 * - Regular dice: Use the roll value
 * - Rerolled dice: Use the last (rerolled) value
 * - Exploding dice: Sum all rolls for that die
 * - Minimum value: Use the minimum if the roll is below it
 */
import { RollDiceParams, DieResult, RollResult } from './types.js';
import { logger } from '../utils/logging.js';

/**
 * Maximum number of rerolls to prevent infinite loops with exploding dice
 */
const MAX_EXPLOSION_DEPTH = 10;

/**
 * Rolls a single die with the specified number of sides.
 * @param sides Number of sides on the die
 * @returns Random number between 1 and sides (inclusive)
 */
export function rollSingleDie(sides: number): number {
	return Math.floor(Math.random() * sides) + 1;
}

/**
 * Performs a dice roll based on the specified parameters.
 * @param params Parameters for the dice roll
 * @returns Result of the dice roll
 */
export function rollDice(params: RollDiceParams): RollResult {
	const {
		dice_count,
		dice_sides,
		modifier = 0,
		keep_highest,
		keep_lowest,
		reroll = [],
		exploding = false,
		target_number,
		min_value,
	} = params;

	// Roll all dice
	let dice: DieResult[] = Array.from({ length: dice_count }, (_, i) => {
		return {
			die: i + 1,
			sides: dice_sides,
			rolls: [rollSingleDie(dice_sides)],
			value: 0, // Will be set after all operations
			kept: true, // Will be updated if keep operations are used
			special: null,
		};
	});

	// Apply rerolls if specified
	if (reroll.length > 0) {
		dice = rerollDice(dice, reroll);
	}

	// Apply exploding dice if specified
	if (exploding) {
		dice = explodeDice(dice);
	}

	// Apply minimum value if specified
	if (min_value !== undefined) {
		dice = applyMinValue(dice, min_value);
	}

	// Apply keep highest/lowest if specified
	if (keep_highest !== undefined) {
		dice = keepHighestDice(dice, keep_highest);
	} else if (keep_lowest !== undefined) {
		dice = keepLowestDice(dice, keep_lowest);
	}

	// Set the final value for each die based on the last roll or minimum value if applied
	dice = dice.map((die) => {
		// If the die already has a value set (e.g., from applyMinValue), use that
		if (die.value > 0) {
			return die;
		}

		// For different operations, calculate value differently
		let calculatedValue;

		if (die.special === 'exploded') {
			// For exploding dice, sum all rolls
			calculatedValue = die.rolls.reduce((a, b) => a + b, 0);
		} else if (die.special === 'rerolled') {
			// For rerolled dice, use the last roll
			calculatedValue = die.rolls[die.rolls.length - 1];
		} else {
			// For normal dice, use the only roll
			calculatedValue = die.rolls[0];
		}

		return {
			...die,
			value: calculatedValue,
		};
	});

	let total = 0;
	let successes: number | undefined = undefined;
	let total_dice: number | undefined = undefined;

	// If target number is specified, count successes
	if (target_number !== undefined) {
		const successCount = countSuccesses(dice, target_number);
		successes = successCount;
		total_dice = dice.length;
		total = successCount; // Set total to success count for consistency
	} else {
		// Otherwise calculate sum of kept dice
		total =
			dice.filter((d) => d.kept).reduce((sum, die) => sum + die.value, 0) +
			modifier;
	}

	// Generate operation notation and description
	const operation = generateOperation(params);
	const description = generateDescription(params);

	return {
		total,
		...(successes !== undefined ? { successes, total_dice } : {}),
		dice,
		operation,
		description,
	};
}

/**
 * Applies the "keep highest" rule to dice results.
 * @param dice Array of dice results
 * @param count Number of highest dice to keep
 * @returns Updated dice array
 */
export function keepHighestDice(dice: DieResult[], count: number): DieResult[] {
	// Sort by value (highest first)
	const sortedDice = [...dice].sort(
		(a, b) => Math.max(...b.rolls) - Math.max(...a.rolls)
	);

	// Mark dice to keep or drop
	return dice.map((die) => {
		const sortedIndex = sortedDice.findIndex(
			(d) =>
				d.die === die.die &&
				d.sides === die.sides &&
				d.rolls.every((r, i) => r === die.rolls[i])
		);

		return {
			...die,
			kept: sortedIndex < count,
		};
	});
}

/**
 * Applies the "keep lowest" rule to dice results.
 * @param dice Array of dice results
 * @param count Number of lowest dice to keep
 * @returns Updated dice array
 */
export function keepLowestDice(dice: DieResult[], count: number): DieResult[] {
	// Sort by value (lowest first)
	const sortedDice = [...dice].sort(
		(a, b) => Math.max(...a.rolls) - Math.max(...b.rolls)
	);

	// Mark dice to keep or drop
	return dice.map((die) => {
		const sortedIndex = sortedDice.findIndex(
			(d) =>
				d.die === die.die &&
				d.sides === die.sides &&
				d.rolls.every((r, i) => r === die.rolls[i])
		);

		return {
			...die,
			kept: sortedIndex < count,
		};
	});
}

/**
 * Rerolls dice that show specified values.
 * @param dice Array of dice results
 * @param rerollValues Array of values that trigger a reroll
 * @returns Updated dice array
 */
export function rerollDice(
	dice: DieResult[],
	rerollValues: number[]
): DieResult[] {
	return dice.map((die) => {
		// Check if the first roll matches any reroll value
		const initialRoll = die.rolls[0];
		if (rerollValues.includes(initialRoll)) {
			// Reroll once
			const rerollValue = rollSingleDie(die.sides);
			return {
				...die,
				rolls: [...die.rolls, rerollValue],
				special: 'rerolled',
			};
		}
		return die;
	});
}

/**
 * Implements exploding dice (reroll and add on maximum value).
 * @param dice Array of dice results
 * @returns Updated dice array
 */
export function explodeDice(dice: DieResult[]): DieResult[] {
	return dice.map((die) => {
		let currentRolls = [...die.rolls];
		let special: string | null = null;

		// Keep exploding as long as maximum value is rolled
		// and we haven't exceeded the maximum explosion depth
		let lastRoll = currentRolls[currentRolls.length - 1];
		let explosionCount = 0;

		while (lastRoll === die.sides && explosionCount < MAX_EXPLOSION_DEPTH) {
			special = 'exploded';
			const explosionRoll = rollSingleDie(die.sides);
			currentRolls.push(explosionRoll);
			lastRoll = explosionRoll;
			explosionCount++;
		}

		return {
			...die,
			rolls: currentRolls,
			special,
		};
	});
}

/**
 * Applies a minimum value to dice results.
 * @param dice Array of dice results
 * @param minValue Minimum value for any die
 * @returns Updated dice array
 */
export function applyMinValue(
	dice: DieResult[],
	minValue: number
): DieResult[] {
	return dice.map((die) => {
		// For each die, check if any roll is below the minimum value
		const allRolls = die.rolls;
		const finalRoll = allRolls[allRolls.length - 1];

		if (finalRoll < minValue) {
			return {
				...die,
				value: minValue, // Set the value property explicitly
				special: `min-${minValue}`,
			};
		}

		return die;
	});
}

/**
 * Counts dice results that meet or exceed a target number.
 * @param dice Array of dice results
 * @param targetNumber Value to compare against
 * @returns Count of successful dice
 */
export function countSuccesses(
	dice: DieResult[],
	targetNumber: number
): number {
	return dice.filter((die) => {
		// Make sure we're using the final value (which could be higher due to min_value)
		const valueToCheck = die.value > 0 ? die.value : Math.max(...die.rolls);
		return valueToCheck >= targetNumber;
	}).length;
}

/**
 * Generates standard dice notation for the operation.
 * @param params Parameters for the dice roll
 * @returns String representation in standard dice notation
 */
export function generateOperation(params: RollDiceParams): string {
	const {
		dice_count,
		dice_sides,
		modifier,
		keep_highest,
		keep_lowest,
		reroll,
		exploding,
		target_number,
		min_value,
	} = params;

	let operation = `${dice_count}d${dice_sides}`;

	// Add modifiers in order of common convention
	if (keep_highest !== undefined) {
		operation += `kh${keep_highest}`;
	} else if (keep_lowest !== undefined) {
		operation += `kl${keep_lowest}`;
	}

	if (reroll && reroll.length > 0) {
		operation += `r${reroll.join('')}`;
	}

	if (exploding) {
		operation += `!`;
	}

	if (min_value !== undefined) {
		operation += `min${min_value}`;
	}

	if (target_number !== undefined) {
		operation += `>=${target_number}`;
	}

	if (modifier && modifier !== 0) {
		const sign = modifier > 0 ? '+' : '';
		operation += `${sign}${modifier}`;
	}

	return operation;
}

/**
 * Generates a human-readable description of the dice roll.
 * @param params Parameters for the dice roll
 * @returns Human-readable description
 */
export function generateDescription(params: RollDiceParams): string {
	const {
		dice_count,
		dice_sides,
		modifier,
		keep_highest,
		keep_lowest,
		reroll,
		exploding,
		target_number,
		min_value,
	} = params;

	let description = `Rolled ${dice_count}d${dice_sides}`;

	// Add descriptions for each modifier
	if (keep_highest !== undefined) {
		description += `, keeping highest ${keep_highest}`;
	} else if (keep_lowest !== undefined) {
		description += `, keeping lowest ${keep_lowest}`;
	}

	if (reroll && reroll.length > 0) {
		if (reroll.length === 1) {
			description += `, rerolling ${reroll[0]}s`;
		} else {
			description += `, rerolling ${reroll.join(', ')}s`;
		}
	}

	if (exploding) {
		description += `, exploding on ${dice_sides}s`;
	}

	if (min_value !== undefined) {
		description += `, minimum value ${min_value}`;
	}

	if (target_number !== undefined) {
		description += `, counting successes >= ${target_number}`;
	}

	if (modifier && modifier !== 0) {
		const modText =
			modifier > 0 ? `adding ${modifier}` : `subtracting ${Math.abs(modifier)}`;
		description += `, ${modText}`;
	}

	return description;
}
