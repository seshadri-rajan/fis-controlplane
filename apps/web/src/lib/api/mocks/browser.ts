import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Set up MSW worker for browser environment.
 * This intercepts fetch() calls during development.
 */
export const worker = setupWorker(...handlers);
