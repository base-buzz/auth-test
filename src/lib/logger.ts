import fs from "fs";
import path from "path";

const logFilePath = path.join(process.cwd(), "server.log");

/**
 * src/lib/logger.ts
 *
 * Simple server-side logging utility.
 * Currently logs messages to the console.
 * TODO: Enhance with a more robust logging library (e.g., Pino, Winston)
 *       and potentially send logs to a dedicated service.
 */

// Define allowed log levels (adjust as needed)
export type LogLevel = "INFO" | "WARN" | "ERROR"; // Removed DEBUG/FATAL for now

/**
 * Logs a message and optional data payload to the server console.
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
  let logEntry = `${timestamp} [${level}] ${message}`;
  if (data) {
    try {
      // Attempt to stringify data, handle circular references
      const dataString = JSON.stringify(
        data,
        (key, value) => (typeof value === "bigint" ? value.toString() : value) // Convert BigInts
      );
      logEntry += ` - Data: ${dataString}`;
    } catch (error) {
      logEntry += ` - Data: [Could not stringify data - ${
        error instanceof Error ? error.message : "Unknown error"
      }]`;
    }
  }
  logEntry += "\n"; // Add newline

  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error("Failed to write to log file:", err);
    }
  });

  // Basic console logging
  console.log(
    `[${timestamp}] [${level}] ${message}`,
    data !== undefined ? JSON.stringify(data, null, 2) : ""
  );

  // FUTURE: Implement more advanced logging here
  // Example with Pino (requires installation and setup):
  // import pino from 'pino';
  // const logger = pino();
  // switch (level) {
  //   case 'INFO':
  //     logger.info(data, message);
  //     break;
  //   case 'WARN':
  //     logger.warn(data, message);
  //     break;
  //   case 'ERROR':
  //     logger.error(data, message);
  //     break;
  // }
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
