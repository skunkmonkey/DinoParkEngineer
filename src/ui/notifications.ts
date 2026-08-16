import type { Command } from "../platform/types.ts";

export async function invokeNotificationAction(action: Command): Promise<boolean> {
  try {
    await action.run();
    return true;
  } catch {
    return false;
  }
}
