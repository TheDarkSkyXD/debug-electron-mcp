import type { ElectronCommandRequest } from '../../application/commands';
import type { WindowTargetOptions } from '../../application/electron-automation';
import { executeInElectron, findElectronTarget } from './cdp-connection';
import { buildRendererCommand } from './renderer-command-builder';

function formatEvaluationResult(rawResult: string): string | undefined {
  try {
    const result: unknown = JSON.parse(rawResult);
    if (result === null || typeof result !== 'object' || !('success' in result)) return undefined;

    if (!result.success) {
      const error = 'error' in result ? String(result.error) : 'Unknown evaluation error';
      const stack = 'stack' in result && result.stack ? `\nStack: ${String(result.stack)}` : '';
      return `Command failed: ${error}${stack}`;
    }
    const value = 'result' in result ? result.result : undefined;
    return `Command successful${value == null ? '' : `: ${JSON.stringify(value)}`}`;
  } catch {
    return undefined;
  }
}

function formatCommandResult(rawResult: string): string {
  if (rawResult === 'undefined' || rawResult === 'null' || rawResult === '') {
    return (
      `Warning: Command executed but returned ${rawResult || 'empty'} ` +
      "- this may indicate the element wasn't found or the action failed"
    );
  }
  return `Result: ${rawResult}`;
}

export async function sendCommandToElectron(
  request: ElectronCommandRequest,
  windowOptions?: WindowTargetOptions,
): Promise<string> {
  try {
    const target = await findElectronTarget(windowOptions);
    const rawResult = await executeInElectron(buildRendererCommand(request), target);
    if (request.command === 'eval') {
      return formatEvaluationResult(rawResult) ?? formatCommandResult(rawResult);
    }
    return formatCommandResult(rawResult);
  } catch (error) {
    throw new Error(
      `Failed to send command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
