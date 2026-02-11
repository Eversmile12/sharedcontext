import { type Instruction } from '@solana/instructions';
import { appendTransactionMessageInstructions, TransactionMessage, TransactionMessageWithFeePayer } from '@solana/transaction-messages';
import { InstructionPlan } from './instruction-plan';
/**
 * A helper type to append instructions to a transaction message
 * without losing type information about the current instructions.
 */
type AppendTransactionMessageInstructions<TTransactionMessage extends TransactionMessage> = ReturnType<typeof appendTransactionMessageInstructions<TTransactionMessage, Instruction[]>>;
/**
 * Appends all instructions from an instruction plan to a transaction message.
 *
 * This function flattens the instruction plan into its leaf plans and sequentially
 * appends each instruction to the provided transaction message. It handles both
 * single instructions and message packer plans.
 *
 * Note that any {@link MessagePackerInstructionPlan} is assumed to only append
 * instructions. If it modifies other properties of the transaction message, the
 * type of the returned transaction message may not accurately reflect those changes.
 *
 * @typeParam TTransactionMessage - The type of transaction message being modified.
 *
 * @param transactionMessage - The transaction message to append instructions to.
 * @param instructionPlan - The instruction plan containing the instructions to append.
 * @returns The transaction message with all instructions from the plan appended.
 *
 * @example
 * Appending a simple instruction plan to a transaction message.
 * ```ts
 * import { appendTransactionMessageInstructionPlan } from '@solana/instruction-plans';
 * import { createTransactionMessage, setTransactionMessageFeePayer } from '@solana/transaction-messages';
 *
 * const message = setTransactionMessageFeePayer(feePayer, createTransactionMessage({ version: 0 }));
 * const plan = singleInstructionPlan(myInstruction);
 *
 * const messageWithInstructions = appendTransactionMessageInstructionPlan(message, plan);
 * ```
 *
 * @example
 * Appending a sequential instruction plan.
 * ```ts
 * const plan = sequentialInstructionPlan([instructionA, instructionB, instructionC]);
 * const messageWithInstructions = appendTransactionMessageInstructionPlan(message, plan);
 * ```
 *
 * @see {@link InstructionPlan}
 * @see {@link flattenInstructionPlan}
 */
export declare function appendTransactionMessageInstructionPlan<TTransactionMessage extends TransactionMessage & TransactionMessageWithFeePayer>(instructionPlan: InstructionPlan, transactionMessage: TTransactionMessage): AppendTransactionMessageInstructions<TTransactionMessage>;
export {};
//# sourceMappingURL=append-instruction-plan.d.ts.map