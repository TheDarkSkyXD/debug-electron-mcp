import type { ElectronCommandRequest } from '../../application/commands';
import type { WindowTargetOptions } from '../../application/electron-automation';
import { executeInElectron, findElectronTarget, type CdpEvaluationResult } from './cdp-connection';
import { buildRendererCommand } from './renderer-command-builder';

export interface ElectronCommandExecution {
  evaluate(
    javascriptCode: string,
    target?: WindowTargetOptions,
  ): Promise<CdpEvaluationResult | undefined>;
}

const directExecution: ElectronCommandExecution = {
  evaluate: async (javascriptCode, targetOptions) => {
    const target = await findElectronTarget(targetOptions);
    return executeInElectron(javascriptCode, target);
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatEvaluationResult(evaluation: CdpEvaluationResult | undefined): string | undefined {
  if (!evaluation || !isRecord(evaluation.value) || !('success' in evaluation.value)) {
    return undefined;
  }

  if (evaluation.value.success !== true) {
    const error = 'error' in evaluation.value ? String(evaluation.value.error) : 'Unknown error';
    const stack =
      'stack' in evaluation.value && evaluation.value.stack
        ? `\nStack: ${String(evaluation.value.stack)}`
        : '';
    return `Command failed: ${error}${stack}`;
  }

  const value = 'result' in evaluation.value ? evaluation.value.result : undefined;
  return `Command successful${value == null ? '' : `: ${serialize(value)}`}`;
}

function formatCommandResult(result: CdpEvaluationResult | undefined): string {
  if (!result) return 'Command sent successfully';

  switch (result.type) {
    case 'string':
      return `Command executed: ${String(result.value)}`;
    case 'number':
    case 'boolean':
      return `Result: ${String(result.value)}`;
    case 'undefined':
      return 'Command executed successfully';
    case 'object':
      if (result.value === null) return 'Result: null';
      if (result.value === undefined) return 'Result: undefined';
      return `Result: ${serialize(result.value)}`;
    default:
      return `Result type ${result.type}: ${result.description ?? 'no description'}`;
  }
}

export async function sendCommandToElectron(
  request: ElectronCommandRequest,
  windowOptions?: WindowTargetOptions,
  execution: ElectronCommandExecution = directExecution,
): Promise<string> {
  try {
    const rendererCommand = buildRendererCommand(request);
    const evaluation = await execution.evaluate(rendererCommand, windowOptions);
    if (request.command === 'eval') {
      return formatEvaluationResult(evaluation) ?? formatCommandResult(evaluation);
    }
    return formatCommandResult(evaluation);
  } catch (error) {
    throw new Error(
      `Failed to send command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
