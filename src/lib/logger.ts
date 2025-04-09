import fs from "fs";
import path from "path";

const logFilePath = path.join(process.cwd(), "server.log");

// Simple asynchronous file logger
export const logToServer = (
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  data?: unknown
) => {
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
};

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
