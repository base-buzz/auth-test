/**
 * src/lib/logger.ts
 *
 * Simple server-side logging utility.
 * Currently logs messages to the console.
 * TODO: Enhance with a more robust logging library or API endpoint for client logs.
 */

// Removed imports for server-only modules
// import fs from "fs";
// import path from "path";

export type LogLevel = "INFO" | "WARN" | "ERROR";

/**
 * Logs a message and optional data payload to the server/browser console.
 * Prepends log level and timestamp.
 *
 * @param level - The severity level (INFO, WARN, ERROR).
 * @param message - The main log message string.
 * @param data - Optional additional data (object) to log.
 */
export function logToServer(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();

  // Use console logging which works on both server and client
  const logArgs: [string, Record<string, unknown>?] = [
    `[${timestamp}] [${level}] ${message}`,
  ];
  if (data !== undefined) {
    logArgs.push(data);
  }

  switch (level) {
    case "INFO":
      console.info(...logArgs);
      break;
    case "WARN":
      console.warn(...logArgs);
      break;
    case "ERROR":
      console.error(...logArgs);
      break;
    default:
      console.log(...logArgs); // Fallback
  }

  // Removed file writing logic as it breaks client components
  // const logFilePath = path.join(process.cwd(), "server.log");
  // const logEntry = `${timestamp} [${level}] ${message}${data ? `: ${JSON.stringify(data)}` : ""}`;
  // fs.appendFile(logFilePath, logEntry + '\n', (err) => { ... });
}

// Example usage:
// logToServer("INFO", "User signed in", { userId: '123' });
// logToServer("ERROR", "Database connection failed", { error: err });

// Optional: Log unhandled exceptions and rejections
process.on("uncaughtException", (error) => {
  logToServer("ERROR", "Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });
  console.error("Uncaught Exception:", error);
  // Consider exiting the process gracefully depending on the error
  // process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logToServer("ERROR", "Unhandled Rejection", { reason });
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Consider exiting the process gracefully
  // process.exit(1);
});
