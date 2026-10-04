export type ActionState = {
  /** Form-level problem, e.g. a wrong PIN or a lockout. */
  error?: string;
  /** Per-input messages keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** Set on success so the form can show a confirmation or navigate. */
  ok?: boolean;
  /** Where the client should go next, e.g. "/plan" after joining. */
  redirectTo?: string;
  /** Arbitrary payload for non-form actions (e.g., search results). */
  payload?: unknown;
};

export const idleState: ActionState = {};

export function failed(
  error: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { error, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Wraps a handler so an unexpected throw becomes a form error, never a crash. */
export async function runAction(
  work: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong. Try again.";
    return failed(
      message.includes("environment variable")
        ? "The server is missing its setup. Check .env.local."
        : message,
    );
  }
}
