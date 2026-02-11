import { SolanaError, SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE, SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN, SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND, SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN, SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT, SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND, SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN, SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND, SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED, isSolanaError, SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN } from '@solana/errors';
import { appendTransactionMessageInstruction, appendTransactionMessageInstructions } from '@solana/transaction-messages';
import { getTransactionMessageSize, TRANSACTION_SIZE_LIMIT, getSignatureFromTransaction } from '@solana/transactions';
import { getAbortablePromise } from '@solana/promises';

// src/append-instruction-plan.ts
function parallelInstructionPlan(plans) {
  return Object.freeze({
    kind: "parallel",
    plans: parseSingleInstructionPlans(plans)
  });
}
function sequentialInstructionPlan(plans) {
  return Object.freeze({
    divisible: true,
    kind: "sequential",
    plans: parseSingleInstructionPlans(plans)
  });
}
function nonDivisibleSequentialInstructionPlan(plans) {
  return Object.freeze({
    divisible: false,
    kind: "sequential",
    plans: parseSingleInstructionPlans(plans)
  });
}
function singleInstructionPlan(instruction) {
  return Object.freeze({ instruction, kind: "single" });
}
function parseSingleInstructionPlans(plans) {
  return plans.map((plan) => "kind" in plan ? plan : singleInstructionPlan(plan));
}
function isSingleInstructionPlan(plan) {
  return plan.kind === "single";
}
function assertIsSingleInstructionPlan(plan) {
  if (!isSingleInstructionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "single",
      instructionPlan: plan
    });
  }
}
function isMessagePackerInstructionPlan(plan) {
  return plan.kind === "messagePacker";
}
function assertIsMessagePackerInstructionPlan(plan) {
  if (!isMessagePackerInstructionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "messagePacker",
      instructionPlan: plan
    });
  }
}
function isSequentialInstructionPlan(plan) {
  return plan.kind === "sequential";
}
function assertIsSequentialInstructionPlan(plan) {
  if (!isSequentialInstructionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "sequential",
      instructionPlan: plan
    });
  }
}
function isNonDivisibleSequentialInstructionPlan(plan) {
  return plan.kind === "sequential" && plan.divisible === false;
}
function assertIsNonDivisibleSequentialInstructionPlan(plan) {
  if (!isNonDivisibleSequentialInstructionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, {
      actualKind: plan.kind === "sequential" ? "divisible sequential" : plan.kind,
      expectedKind: "non-divisible sequential",
      instructionPlan: plan
    });
  }
}
function isParallelInstructionPlan(plan) {
  return plan.kind === "parallel";
}
function assertIsParallelInstructionPlan(plan) {
  if (!isParallelInstructionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "parallel",
      instructionPlan: plan
    });
  }
}
function findInstructionPlan(instructionPlan, predicate) {
  if (predicate(instructionPlan)) {
    return instructionPlan;
  }
  if (instructionPlan.kind === "single" || instructionPlan.kind === "messagePacker") {
    return void 0;
  }
  for (const subPlan of instructionPlan.plans) {
    const foundPlan = findInstructionPlan(subPlan, predicate);
    if (foundPlan) {
      return foundPlan;
    }
  }
  return void 0;
}
function everyInstructionPlan(instructionPlan, predicate) {
  if (!predicate(instructionPlan)) {
    return false;
  }
  if (instructionPlan.kind === "single" || instructionPlan.kind === "messagePacker") {
    return true;
  }
  return instructionPlan.plans.every((p) => everyInstructionPlan(p, predicate));
}
function transformInstructionPlan(instructionPlan, fn) {
  if (instructionPlan.kind === "single" || instructionPlan.kind === "messagePacker") {
    return Object.freeze(fn(instructionPlan));
  }
  return Object.freeze(
    fn(
      Object.freeze({
        ...instructionPlan,
        plans: instructionPlan.plans.map((p) => transformInstructionPlan(p, fn))
      })
    )
  );
}
function flattenInstructionPlan(instructionPlan) {
  if (instructionPlan.kind === "single" || instructionPlan.kind === "messagePacker") {
    return [instructionPlan];
  }
  return instructionPlan.plans.flatMap(flattenInstructionPlan);
}
function getLinearMessagePackerInstructionPlan({
  getInstruction,
  totalLength: totalBytes
}) {
  return Object.freeze({
    getMessagePacker: () => {
      let offset = 0;
      return Object.freeze({
        done: () => offset >= totalBytes,
        packMessageToCapacity: (message) => {
          if (offset >= totalBytes) {
            throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE);
          }
          const messageSizeWithBaseInstruction = getTransactionMessageSize(
            appendTransactionMessageInstruction(getInstruction(offset, 0), message)
          );
          const freeSpace = TRANSACTION_SIZE_LIMIT - messageSizeWithBaseInstruction - 1;
          if (freeSpace <= 0) {
            const messageSize = getTransactionMessageSize(message);
            throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN, {
              // (+1) We need to pack at least one byte of data otherwise
              // there is no point packing the base instruction alone.
              numBytesRequired: messageSizeWithBaseInstruction - messageSize + 1,
              // (-1) Leeway for shortU16 numbers in transaction headers.
              numFreeBytes: TRANSACTION_SIZE_LIMIT - messageSize - 1
            });
          }
          const length = Math.min(totalBytes - offset, freeSpace);
          const instruction = getInstruction(offset, length);
          offset += length;
          return appendTransactionMessageInstruction(instruction, message);
        }
      });
    },
    kind: "messagePacker"
  });
}
function getMessagePackerInstructionPlanFromInstructions(instructions) {
  return Object.freeze({
    getMessagePacker: () => {
      let instructionIndex = 0;
      return Object.freeze({
        done: () => instructionIndex >= instructions.length,
        packMessageToCapacity: (message) => {
          if (instructionIndex >= instructions.length) {
            throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE);
          }
          const originalMessageSize = getTransactionMessageSize(message);
          for (let index = instructionIndex; index < instructions.length; index++) {
            message = appendTransactionMessageInstruction(instructions[index], message);
            const messageSize = getTransactionMessageSize(message);
            if (messageSize > TRANSACTION_SIZE_LIMIT) {
              if (index === instructionIndex) {
                throw new SolanaError(
                  SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN,
                  {
                    numBytesRequired: messageSize - originalMessageSize,
                    numFreeBytes: TRANSACTION_SIZE_LIMIT - originalMessageSize
                  }
                );
              }
              instructionIndex = index;
              return message;
            }
          }
          instructionIndex = instructions.length;
          return message;
        }
      });
    },
    kind: "messagePacker"
  });
}
var REALLOC_LIMIT = 10240;
function getReallocMessagePackerInstructionPlan({
  getInstruction,
  totalSize
}) {
  const numberOfInstructions = Math.ceil(totalSize / REALLOC_LIMIT);
  const lastInstructionSize = totalSize % REALLOC_LIMIT;
  const instructions = new Array(numberOfInstructions).fill(0).map((_, i) => getInstruction(i === numberOfInstructions - 1 ? lastInstructionSize : REALLOC_LIMIT));
  return getMessagePackerInstructionPlanFromInstructions(instructions);
}

// src/append-instruction-plan.ts
function appendTransactionMessageInstructionPlan(instructionPlan, transactionMessage) {
  const leafInstructionPlans = flattenInstructionPlan(instructionPlan);
  return leafInstructionPlans.reduce(
    (messageSoFar, plan) => {
      const kind = plan.kind;
      if (kind === "single") {
        return appendTransactionMessageInstruction(plan.instruction, messageSoFar);
      }
      if (kind === "messagePacker") {
        const messagerPacker = plan.getMessagePacker();
        let nextMessage = messageSoFar;
        while (!messagerPacker.done()) {
          nextMessage = messagerPacker.packMessageToCapacity(nextMessage);
        }
        return nextMessage;
      }
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND, {
        kind
      });
    },
    transactionMessage
  );
}
function parallelTransactionPlan(plans) {
  return Object.freeze({ kind: "parallel", plans: parseSingleTransactionPlans(plans) });
}
function sequentialTransactionPlan(plans) {
  return Object.freeze({ divisible: true, kind: "sequential", plans: parseSingleTransactionPlans(plans) });
}
function nonDivisibleSequentialTransactionPlan(plans) {
  return Object.freeze({ divisible: false, kind: "sequential", plans: parseSingleTransactionPlans(plans) });
}
function singleTransactionPlan(transactionMessage) {
  return Object.freeze({ kind: "single", message: transactionMessage });
}
function parseSingleTransactionPlans(plans) {
  return plans.map((plan) => "kind" in plan ? plan : singleTransactionPlan(plan));
}
function isSingleTransactionPlan(plan) {
  return plan.kind === "single";
}
function assertIsSingleTransactionPlan(plan) {
  if (!isSingleTransactionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "single",
      transactionPlan: plan
    });
  }
}
function isSequentialTransactionPlan(plan) {
  return plan.kind === "sequential";
}
function assertIsSequentialTransactionPlan(plan) {
  if (!isSequentialTransactionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "sequential",
      transactionPlan: plan
    });
  }
}
function isNonDivisibleSequentialTransactionPlan(plan) {
  return plan.kind === "sequential" && plan.divisible === false;
}
function assertIsNonDivisibleSequentialTransactionPlan(plan) {
  if (!isNonDivisibleSequentialTransactionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN, {
      actualKind: plan.kind === "sequential" ? "divisible sequential" : plan.kind,
      expectedKind: "non-divisible sequential",
      transactionPlan: plan
    });
  }
}
function isParallelTransactionPlan(plan) {
  return plan.kind === "parallel";
}
function assertIsParallelTransactionPlan(plan) {
  if (!isParallelTransactionPlan(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN, {
      actualKind: plan.kind,
      expectedKind: "parallel",
      transactionPlan: plan
    });
  }
}
var getAllSingleTransactionPlans = flattenTransactionPlan;
function flattenTransactionPlan(transactionPlan) {
  if (transactionPlan.kind === "single") {
    return [transactionPlan];
  }
  return transactionPlan.plans.flatMap(flattenTransactionPlan);
}
function findTransactionPlan(transactionPlan, predicate) {
  if (predicate(transactionPlan)) {
    return transactionPlan;
  }
  if (transactionPlan.kind === "single") {
    return void 0;
  }
  for (const subPlan of transactionPlan.plans) {
    const foundPlan = findTransactionPlan(subPlan, predicate);
    if (foundPlan) {
      return foundPlan;
    }
  }
  return void 0;
}
function everyTransactionPlan(transactionPlan, predicate) {
  if (!predicate(transactionPlan)) {
    return false;
  }
  if (transactionPlan.kind === "single") {
    return true;
  }
  return transactionPlan.plans.every((p) => everyTransactionPlan(p, predicate));
}
function transformTransactionPlan(transactionPlan, fn) {
  if (transactionPlan.kind === "single") {
    return Object.freeze(fn(transactionPlan));
  }
  return Object.freeze(
    fn(
      Object.freeze({
        ...transactionPlan,
        plans: transactionPlan.plans.map((p) => transformTransactionPlan(p, fn))
      })
    )
  );
}
function sequentialTransactionPlanResult(plans) {
  return Object.freeze({ divisible: true, kind: "sequential", plans });
}
function nonDivisibleSequentialTransactionPlanResult(plans) {
  return Object.freeze({ divisible: false, kind: "sequential", plans });
}
function parallelTransactionPlanResult(plans) {
  return Object.freeze({ kind: "parallel", plans });
}
function successfulSingleTransactionPlanResult(transactionMessage, transaction, context) {
  return Object.freeze({
    kind: "single",
    message: transactionMessage,
    status: Object.freeze({
      context: context ?? {},
      kind: "successful",
      signature: getSignatureFromTransaction(transaction),
      transaction
    })
  });
}
function successfulSingleTransactionPlanResultFromSignature(transactionMessage, signature, context) {
  return Object.freeze({
    kind: "single",
    message: transactionMessage,
    status: Object.freeze({ context: context ?? {}, kind: "successful", signature })
  });
}
function failedSingleTransactionPlanResult(transactionMessage, error) {
  return Object.freeze({
    kind: "single",
    message: transactionMessage,
    status: Object.freeze({ error, kind: "failed" })
  });
}
function canceledSingleTransactionPlanResult(transactionMessage) {
  return Object.freeze({
    kind: "single",
    message: transactionMessage,
    status: Object.freeze({ kind: "canceled" })
  });
}
function isSingleTransactionPlanResult(plan) {
  return plan.kind === "single";
}
function assertIsSingleTransactionPlanResult(plan) {
  if (!isSingleTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind,
      expectedKind: "single",
      transactionPlanResult: plan
    });
  }
}
function isSuccessfulSingleTransactionPlanResult(plan) {
  return plan.kind === "single" && plan.status.kind === "successful";
}
function assertIsSuccessfulSingleTransactionPlanResult(plan) {
  if (!isSuccessfulSingleTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind === "single" ? `${plan.status.kind} single` : plan.kind,
      expectedKind: "successful single",
      transactionPlanResult: plan
    });
  }
}
function isFailedSingleTransactionPlanResult(plan) {
  return plan.kind === "single" && plan.status.kind === "failed";
}
function assertIsFailedSingleTransactionPlanResult(plan) {
  if (!isFailedSingleTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind === "single" ? `${plan.status.kind} single` : plan.kind,
      expectedKind: "failed single",
      transactionPlanResult: plan
    });
  }
}
function isCanceledSingleTransactionPlanResult(plan) {
  return plan.kind === "single" && plan.status.kind === "canceled";
}
function assertIsCanceledSingleTransactionPlanResult(plan) {
  if (!isCanceledSingleTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind === "single" ? `${plan.status.kind} single` : plan.kind,
      expectedKind: "canceled single",
      transactionPlanResult: plan
    });
  }
}
function isSequentialTransactionPlanResult(plan) {
  return plan.kind === "sequential";
}
function assertIsSequentialTransactionPlanResult(plan) {
  if (!isSequentialTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind,
      expectedKind: "sequential",
      transactionPlanResult: plan
    });
  }
}
function isNonDivisibleSequentialTransactionPlanResult(plan) {
  return plan.kind === "sequential" && plan.divisible === false;
}
function assertIsNonDivisibleSequentialTransactionPlanResult(plan) {
  if (!isNonDivisibleSequentialTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind === "sequential" ? "divisible sequential" : plan.kind,
      expectedKind: "non-divisible sequential",
      transactionPlanResult: plan
    });
  }
}
function isParallelTransactionPlanResult(plan) {
  return plan.kind === "parallel";
}
function assertIsParallelTransactionPlanResult(plan) {
  if (!isParallelTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT, {
      actualKind: plan.kind,
      expectedKind: "parallel",
      transactionPlanResult: plan
    });
  }
}
function isSuccessfulTransactionPlanResult(plan) {
  return everyTransactionPlanResult(
    plan,
    (r) => !isSingleTransactionPlanResult(r) || isSuccessfulSingleTransactionPlanResult(r)
  );
}
function assertIsSuccessfulTransactionPlanResult(plan) {
  if (!isSuccessfulTransactionPlanResult(plan)) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT, {
      transactionPlanResult: plan
    });
  }
}
function findTransactionPlanResult(transactionPlanResult, predicate) {
  if (predicate(transactionPlanResult)) {
    return transactionPlanResult;
  }
  if (transactionPlanResult.kind === "single") {
    return void 0;
  }
  for (const subResult of transactionPlanResult.plans) {
    const foundResult = findTransactionPlanResult(subResult, predicate);
    if (foundResult) {
      return foundResult;
    }
  }
  return void 0;
}
function getFirstFailedSingleTransactionPlanResult(transactionPlanResult) {
  const result = findTransactionPlanResult(
    transactionPlanResult,
    (r) => r.kind === "single" && r.status.kind === "failed"
  );
  if (!result) {
    const context = {};
    Object.defineProperty(context, "transactionPlanResult", {
      configurable: false,
      enumerable: false,
      value: transactionPlanResult,
      writable: false
    });
    throw new SolanaError(
      SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND,
      context
    );
  }
  return result;
}
function everyTransactionPlanResult(transactionPlanResult, predicate) {
  if (!predicate(transactionPlanResult)) {
    return false;
  }
  if (transactionPlanResult.kind === "single") {
    return true;
  }
  return transactionPlanResult.plans.every((p) => everyTransactionPlanResult(p, predicate));
}
function transformTransactionPlanResult(transactionPlanResult, fn) {
  if (transactionPlanResult.kind === "single") {
    return Object.freeze(fn(transactionPlanResult));
  }
  return Object.freeze(
    fn(
      Object.freeze({
        ...transactionPlanResult,
        plans: transactionPlanResult.plans.map((p) => transformTransactionPlanResult(p, fn))
      })
    )
  );
}
function flattenTransactionPlanResult(result) {
  if (result.kind === "single") {
    return [result];
  }
  return result.plans.flatMap(flattenTransactionPlanResult);
}
function summarizeTransactionPlanResult(result) {
  const successfulTransactions = [];
  const failedTransactions = [];
  const canceledTransactions = [];
  const flattenedResults = flattenTransactionPlanResult(result);
  for (const singleResult of flattenedResults) {
    switch (singleResult.status.kind) {
      case "successful": {
        successfulTransactions.push(singleResult);
        break;
      }
      case "failed": {
        failedTransactions.push(singleResult);
        break;
      }
      case "canceled": {
        canceledTransactions.push(singleResult);
        break;
      }
    }
  }
  return Object.freeze({
    canceledTransactions,
    failedTransactions,
    successful: failedTransactions.length === 0 && canceledTransactions.length === 0,
    successfulTransactions
  });
}

// src/transaction-plan-executor.ts
function createTransactionPlanExecutor(config) {
  return async (plan, { abortSignal } = {}) => {
    const context = {
      ...config,
      abortSignal,
      canceled: abortSignal?.aborted ?? false
    };
    assertDivisibleSequentialPlansOnly(plan);
    const cancelHandler = () => {
      context.canceled = true;
    };
    abortSignal?.addEventListener("abort", cancelHandler);
    const transactionPlanResult = await traverse(plan, context);
    abortSignal?.removeEventListener("abort", cancelHandler);
    if (context.canceled) {
      const abortReason = abortSignal?.aborted ? abortSignal.reason : void 0;
      const context2 = { cause: findErrorFromTransactionPlanResult(transactionPlanResult) ?? abortReason };
      Object.defineProperty(context2, "transactionPlanResult", {
        configurable: false,
        enumerable: false,
        value: transactionPlanResult,
        writable: false
      });
      throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN, context2);
    }
    return transactionPlanResult;
  };
}
async function traverse(transactionPlan, context) {
  const kind = transactionPlan.kind;
  switch (kind) {
    case "sequential":
      return await traverseSequential(transactionPlan, context);
    case "parallel":
      return await traverseParallel(transactionPlan, context);
    case "single":
      return await traverseSingle(transactionPlan, context);
    default:
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND, { kind });
  }
}
async function traverseSequential(transactionPlan, context) {
  if (!transactionPlan.divisible) {
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED);
  }
  const results = [];
  for (const subPlan of transactionPlan.plans) {
    const result = await traverse(subPlan, context);
    results.push(result);
  }
  return sequentialTransactionPlanResult(results);
}
async function traverseParallel(transactionPlan, context) {
  const results = await Promise.all(transactionPlan.plans.map((plan) => traverse(plan, context)));
  return parallelTransactionPlanResult(results);
}
async function traverseSingle(transactionPlan, context) {
  if (context.canceled) {
    return canceledSingleTransactionPlanResult(transactionPlan.message);
  }
  try {
    const result = await getAbortablePromise(
      context.executeTransactionMessage(transactionPlan.message, { abortSignal: context.abortSignal }),
      context.abortSignal
    );
    if ("transaction" in result) {
      return successfulSingleTransactionPlanResult(transactionPlan.message, result.transaction, result.context);
    } else {
      return successfulSingleTransactionPlanResultFromSignature(
        transactionPlan.message,
        result.signature,
        result.context
      );
    }
  } catch (error) {
    context.canceled = true;
    return failedSingleTransactionPlanResult(transactionPlan.message, error);
  }
}
function findErrorFromTransactionPlanResult(result) {
  if (result.kind === "single") {
    return result.status.kind === "failed" ? result.status.error : void 0;
  }
  for (const plan of result.plans) {
    const error = findErrorFromTransactionPlanResult(plan);
    if (error) {
      return error;
    }
  }
}
function assertDivisibleSequentialPlansOnly(transactionPlan) {
  const kind = transactionPlan.kind;
  switch (kind) {
    case "sequential":
      if (!transactionPlan.divisible) {
        throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED);
      }
      for (const subPlan of transactionPlan.plans) {
        assertDivisibleSequentialPlansOnly(subPlan);
      }
      return;
    case "parallel":
      for (const subPlan of transactionPlan.plans) {
        assertDivisibleSequentialPlansOnly(subPlan);
      }
      return;
    case "single":
    default:
      return;
  }
}
async function passthroughFailedTransactionPlanExecution(promise) {
  try {
    return await promise;
  } catch (error) {
    if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN)) {
      return error.context.transactionPlanResult;
    }
    throw error;
  }
}
function createTransactionPlanner(config) {
  return async (instructionPlan, { abortSignal } = {}) => {
    const plan = await traverse2(instructionPlan, {
      abortSignal,
      createTransactionMessage: config.createTransactionMessage,
      onTransactionMessageUpdated: config.onTransactionMessageUpdated ?? ((msg) => msg),
      parent: null,
      parentCandidates: []
    });
    if (!plan) {
      throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN);
    }
    return freezeTransactionPlan(plan);
  };
}
async function traverse2(instructionPlan, context) {
  context.abortSignal?.throwIfAborted();
  const kind = instructionPlan.kind;
  switch (kind) {
    case "sequential":
      return await traverseSequential2(instructionPlan, context);
    case "parallel":
      return await traverseParallel2(instructionPlan, context);
    case "single":
      return await traverseSingle2(instructionPlan, context);
    case "messagePacker":
      return await traverseMessagePacker(instructionPlan, context);
    default:
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND, { kind });
  }
}
async function traverseSequential2(instructionPlan, context) {
  let candidate = null;
  const mustEntirelyFitInParentCandidate = context.parent && (context.parent.kind === "parallel" || !instructionPlan.divisible);
  if (mustEntirelyFitInParentCandidate) {
    const candidate2 = await selectAndMutateCandidate(
      context,
      context.parentCandidates,
      (message) => fitEntirePlanInsideMessage(instructionPlan, message)
    );
    if (candidate2) {
      return null;
    }
  } else {
    candidate = context.parentCandidates.length > 0 ? context.parentCandidates[0] : null;
  }
  const transactionPlans = [];
  for (const plan of instructionPlan.plans) {
    const transactionPlan = await traverse2(plan, {
      ...context,
      parent: instructionPlan,
      parentCandidates: candidate ? [candidate] : []
    });
    if (transactionPlan) {
      candidate = getSequentialCandidate(transactionPlan);
      const newPlans = transactionPlan.kind === "sequential" && (transactionPlan.divisible || !instructionPlan.divisible) ? transactionPlan.plans : [transactionPlan];
      transactionPlans.push(...newPlans);
    }
  }
  if (transactionPlans.length === 1) {
    return transactionPlans[0];
  }
  if (transactionPlans.length === 0) {
    return null;
  }
  return {
    divisible: instructionPlan.divisible,
    kind: "sequential",
    plans: transactionPlans
  };
}
async function traverseParallel2(instructionPlan, context) {
  const candidates = [...context.parentCandidates];
  const transactionPlans = [];
  const sortedChildren = Array.from(instructionPlan.plans).sort(
    (a, b) => Number(a.kind === "messagePacker") - Number(b.kind === "messagePacker")
  );
  for (const plan of sortedChildren) {
    const transactionPlan = await traverse2(plan, {
      ...context,
      parent: instructionPlan,
      parentCandidates: candidates
    });
    if (transactionPlan) {
      candidates.push(...getParallelCandidates(transactionPlan));
      const newPlans = transactionPlan.kind === "parallel" ? transactionPlan.plans : [transactionPlan];
      transactionPlans.push(...newPlans);
    }
  }
  if (transactionPlans.length === 1) {
    return transactionPlans[0];
  }
  if (transactionPlans.length === 0) {
    return null;
  }
  return { kind: "parallel", plans: transactionPlans };
}
async function traverseSingle2(instructionPlan, context) {
  const predicate = (message2) => appendTransactionMessageInstructions([instructionPlan.instruction], message2);
  const candidate = await selectAndMutateCandidate(context, context.parentCandidates, predicate);
  if (candidate) {
    return null;
  }
  const message = await createNewMessage(context, predicate);
  return { kind: "single", message };
}
async function traverseMessagePacker(instructionPlan, context) {
  const messagePacker = instructionPlan.getMessagePacker();
  const transactionPlans = [];
  const candidates = [...context.parentCandidates];
  while (!messagePacker.done()) {
    const candidate = await selectAndMutateCandidate(context, candidates, messagePacker.packMessageToCapacity);
    if (!candidate) {
      const message = await createNewMessage(context, messagePacker.packMessageToCapacity);
      const newPlan = { kind: "single", message };
      transactionPlans.push(newPlan);
    }
  }
  if (transactionPlans.length === 1) {
    return transactionPlans[0];
  }
  if (transactionPlans.length === 0) {
    return null;
  }
  if (context.parent?.kind === "parallel") {
    return { kind: "parallel", plans: transactionPlans };
  }
  return {
    divisible: context.parent?.kind === "sequential" ? context.parent.divisible : true,
    kind: "sequential",
    plans: transactionPlans
  };
}
function getSequentialCandidate(latestPlan) {
  if (latestPlan.kind === "single") {
    return latestPlan;
  }
  if (latestPlan.kind === "sequential" && latestPlan.plans.length > 0) {
    return getSequentialCandidate(latestPlan.plans[latestPlan.plans.length - 1]);
  }
  return null;
}
function getParallelCandidates(latestPlan) {
  return flattenTransactionPlan(latestPlan);
}
async function selectAndMutateCandidate(context, candidates, predicate) {
  for (const candidate of candidates) {
    try {
      const message = await getAbortablePromise(
        Promise.resolve(
          context.onTransactionMessageUpdated(predicate(candidate.message), {
            abortSignal: context.abortSignal
          })
        ),
        context.abortSignal
      );
      if (getTransactionMessageSize(message) <= TRANSACTION_SIZE_LIMIT) {
        candidate.message = message;
        return candidate;
      }
    } catch (error) {
      if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN)) ; else {
        throw error;
      }
    }
  }
  return null;
}
async function createNewMessage(context, predicate) {
  const newMessage = await getAbortablePromise(
    Promise.resolve(context.createTransactionMessage({ abortSignal: context.abortSignal })),
    context.abortSignal
  );
  const updatedMessage = await getAbortablePromise(
    Promise.resolve(
      context.onTransactionMessageUpdated(predicate(newMessage), { abortSignal: context.abortSignal })
    ),
    context.abortSignal
  );
  const updatedMessageSize = getTransactionMessageSize(updatedMessage);
  if (updatedMessageSize > TRANSACTION_SIZE_LIMIT) {
    const newMessageSize = getTransactionMessageSize(newMessage);
    throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN, {
      numBytesRequired: updatedMessageSize - newMessageSize,
      numFreeBytes: TRANSACTION_SIZE_LIMIT - newMessageSize
    });
  }
  return updatedMessage;
}
function freezeTransactionPlan(plan) {
  const kind = plan.kind;
  switch (kind) {
    case "single":
      return singleTransactionPlan(plan.message);
    case "sequential":
      return plan.divisible ? sequentialTransactionPlan(plan.plans.map(freezeTransactionPlan)) : nonDivisibleSequentialTransactionPlan(plan.plans.map(freezeTransactionPlan));
    case "parallel":
      return parallelTransactionPlan(plan.plans.map(freezeTransactionPlan));
    default:
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND, { kind });
  }
}
function fitEntirePlanInsideMessage(instructionPlan, message) {
  let newMessage = message;
  const kind = instructionPlan.kind;
  switch (kind) {
    case "sequential":
    case "parallel":
      for (const plan of instructionPlan.plans) {
        newMessage = fitEntirePlanInsideMessage(plan, newMessage);
      }
      return newMessage;
    case "single":
      newMessage = appendTransactionMessageInstructions([instructionPlan.instruction], message);
      const newMessageSize = getTransactionMessageSize(newMessage);
      if (newMessageSize > TRANSACTION_SIZE_LIMIT) {
        const baseMessageSize = getTransactionMessageSize(message);
        throw new SolanaError(SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN, {
          numBytesRequired: newMessageSize - baseMessageSize,
          numFreeBytes: TRANSACTION_SIZE_LIMIT - baseMessageSize
        });
      }
      return newMessage;
    case "messagePacker":
      const messagePacker = instructionPlan.getMessagePacker();
      while (!messagePacker.done()) {
        newMessage = messagePacker.packMessageToCapacity(newMessage);
      }
      return newMessage;
    default:
      throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND, { kind });
  }
}

export { appendTransactionMessageInstructionPlan, assertIsCanceledSingleTransactionPlanResult, assertIsFailedSingleTransactionPlanResult, assertIsMessagePackerInstructionPlan, assertIsNonDivisibleSequentialInstructionPlan, assertIsNonDivisibleSequentialTransactionPlan, assertIsNonDivisibleSequentialTransactionPlanResult, assertIsParallelInstructionPlan, assertIsParallelTransactionPlan, assertIsParallelTransactionPlanResult, assertIsSequentialInstructionPlan, assertIsSequentialTransactionPlan, assertIsSequentialTransactionPlanResult, assertIsSingleInstructionPlan, assertIsSingleTransactionPlan, assertIsSingleTransactionPlanResult, assertIsSuccessfulSingleTransactionPlanResult, assertIsSuccessfulTransactionPlanResult, canceledSingleTransactionPlanResult, createTransactionPlanExecutor, createTransactionPlanner, everyInstructionPlan, everyTransactionPlan, everyTransactionPlanResult, failedSingleTransactionPlanResult, findInstructionPlan, findTransactionPlan, findTransactionPlanResult, flattenInstructionPlan, flattenTransactionPlan, flattenTransactionPlanResult, getAllSingleTransactionPlans, getFirstFailedSingleTransactionPlanResult, getLinearMessagePackerInstructionPlan, getMessagePackerInstructionPlanFromInstructions, getReallocMessagePackerInstructionPlan, isCanceledSingleTransactionPlanResult, isFailedSingleTransactionPlanResult, isMessagePackerInstructionPlan, isNonDivisibleSequentialInstructionPlan, isNonDivisibleSequentialTransactionPlan, isNonDivisibleSequentialTransactionPlanResult, isParallelInstructionPlan, isParallelTransactionPlan, isParallelTransactionPlanResult, isSequentialInstructionPlan, isSequentialTransactionPlan, isSequentialTransactionPlanResult, isSingleInstructionPlan, isSingleTransactionPlan, isSingleTransactionPlanResult, isSuccessfulSingleTransactionPlanResult, isSuccessfulTransactionPlanResult, nonDivisibleSequentialInstructionPlan, nonDivisibleSequentialTransactionPlan, nonDivisibleSequentialTransactionPlanResult, parallelInstructionPlan, parallelTransactionPlan, parallelTransactionPlanResult, passthroughFailedTransactionPlanExecution, sequentialInstructionPlan, sequentialTransactionPlan, sequentialTransactionPlanResult, singleInstructionPlan, singleTransactionPlan, successfulSingleTransactionPlanResult, successfulSingleTransactionPlanResultFromSignature, summarizeTransactionPlanResult, transformInstructionPlan, transformTransactionPlan, transformTransactionPlanResult };
//# sourceMappingURL=index.browser.mjs.map
//# sourceMappingURL=index.browser.mjs.map