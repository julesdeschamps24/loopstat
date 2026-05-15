type Fields = Record<string, unknown>;

interface Logger {
  info(fields: Fields, msg: string): void;
  warn(fields: Fields, msg: string): void;
  error(fields: Fields, msg: string): void;
  child(bindings: Fields): Logger;
}

/**
 * Create a logger instance with optional parent bindings.
 * In production, outputs JSON. In dev, pretty-prints.
 */
function makeLogger(parentBindings: Fields = {}): Logger {
  const isProduction = process.env.NODE_ENV === "production";

  /**
   * Merge parent bindings with call fields (call fields win on key collision).
   */
  function mergeFields(callFields: Fields): Fields {
    return { ...parentBindings, ...callFields };
  }

  /**
   * Format a single field value for pretty-printing.
   */
  function formatFieldValue(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /**
   * Pretty-print: [LEVEL] key1=val1 key2=val2 ... message
   */
  function prettyLog(
    level: string,
    fields: Fields,
    msg: string,
    useError: boolean,
  ): void {
    const parts: string[] = [`[${level}]`];

    for (const [key, value] of Object.entries(fields)) {
      parts.push(`${key}=${formatFieldValue(value)}`);
    }

    parts.push(msg);
    const output = parts.join(" ");

    if (useError) {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  /**
   * JSON log: { level, time, ...fields, msg }
   */
  function jsonLog(level: string, fields: Fields, msg: string): void {
    const payload = {
      level,
      time: new Date().toISOString(),
      ...fields,
      msg,
    };

    const isError = level === "error";
    if (isError) {
      console.error(JSON.stringify(payload));
    } else {
      console.log(JSON.stringify(payload));
    }
  }

  const logger: Logger = {
    info(fields: Fields, msg: string): void {
      const merged = mergeFields(fields);
      if (isProduction) {
        jsonLog("info", merged, msg);
      } else {
        prettyLog("info", merged, msg, false);
      }
    },

    warn(fields: Fields, msg: string): void {
      const merged = mergeFields(fields);
      if (isProduction) {
        jsonLog("warn", merged, msg);
      } else {
        prettyLog("warn", merged, msg, false);
      }
    },

    error(fields: Fields, msg: string): void {
      const merged = mergeFields(fields);
      if (isProduction) {
        jsonLog("error", merged, msg);
      } else {
        prettyLog("error", merged, msg, true);
      }
    },

    child(bindings: Fields): Logger {
      return makeLogger({ ...parentBindings, ...bindings });
    },
  };

  return logger;
}

export const log = makeLogger();
