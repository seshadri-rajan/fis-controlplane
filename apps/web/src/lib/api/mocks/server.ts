import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * Set up MSW server for Node.js environment (dev server, tests).
 * In the browser, use setupWorker() instead.
 */
export const server = setupServer(...handlers);
