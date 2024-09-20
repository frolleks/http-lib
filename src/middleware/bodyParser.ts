import * as http from "http";

import type { PathlessRequest } from "..";

export interface UploadedFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

/**
 * Middleware to parse the request body and populate req.body and req.files.
 * @param req The HTTP IncomingMessage object.
 * @param res The HTTP ServerResponse object.
 * @param next The next middleware function.
 */
export function bodyParser(
  req: PathlessRequest,
  res: http.ServerResponse,
  next: (err?: any) => void
): void {
  req.body = {};
  req.files = {};

  if (["POST", "PUT", "PATCH"].includes(req.method || "")) {
    const contentType = req.headers["content-type"] || "";
    const bodyData: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      bodyData.push(chunk);
    });

    req.on("end", () => {
      const rawBody = Buffer.concat(bodyData);

      if (contentType.includes("application/json")) {
        try {
          req.body = JSON.parse(rawBody.toString());
        } catch (err) {
          // Handle JSON parse error
          req.body = {};
        }
        next();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        // Parse URL-encoded data
        const parsedBody = parseURLEncoded(rawBody.toString());
        req.body = parsedBody;
        next();
      } else if (contentType.includes("multipart/form-data")) {
        // Parse multipart form data
        const boundary = getBoundary(contentType);
        if (boundary) {
          const parts = parseMultipart(rawBody, boundary);
          req.body = parts.fields;
          req.files = parts.files;
        }
        next();
      } else {
        // Other content types
        req.body = rawBody;
        next();
      }
    });

    req.on("error", (err) => {
      next(err);
    });
  } else {
    next();
  }
}

/**
 * Parses URL-encoded form data.
 * @param bodyString The raw body string.
 * @returns An object representing the parsed form data.
 */
function parseURLEncoded(bodyString: string): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  const pairs = bodyString.split("&");
  for (const pair of pairs) {
    const [key, value] = pair.split("=").map(decodeURIComponent);
    result[key] = value;
  }
  return result;
}

/**
 * Extracts the boundary string from the Content-Type header.
 * @param contentType The Content-Type header value.
 * @returns The boundary string.
 */
function getBoundary(contentType: string): string | null {
  const items = contentType.split(";");
  for (const item of items) {
    const trimmedItem = item.trim();
    if (trimmedItem.startsWith("boundary=")) {
      return trimmedItem.slice("boundary=".length);
    }
  }
  return null;
}

/**
 * Parses multipart form data.
 * @param rawBody The raw request body as a Buffer.
 * @param boundary The boundary string.
 * @returns An object containing parsed fields and files.
 */
function parseMultipart(
  rawBody: Buffer,
  boundary: string
): {
  fields: { [key: string]: string };
  files: { [key: string]: UploadedFile };
} {
  const result = {
    fields: {} as { [key: string]: string },
    files: {} as { [key: string]: UploadedFile },
  };

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = rawBody
    .toString("binary")
    .split(boundaryBuffer.toString("binary"));

  parts.forEach((part) => {
    // Remove leading CRLF
    if (part.startsWith("\r\n")) {
      part = part.slice(2);
    }

    // Ignore empty parts
    if (part.length === 0 || part === "--\r\n" || part === "--") {
      return;
    }

    const [headerPart, bodyPart] = splitBuffer(part, "\r\n\r\n");
    if (!headerPart || !bodyPart) return;

    const headers = parseHeaders(headerPart);

    const contentDisposition = headers["content-disposition"];
    if (contentDisposition) {
      const nameMatch = contentDisposition.match(/name="([^"]+)"/);
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch) {
          // It's a file
          const filename = filenameMatch[1];
          const contentType =
            headers["content-type"] || "application/octet-stream";
          result.files[fieldName] = {
            filename,
            contentType,
            data: Buffer.from(bodyPart.slice(0, -2), "binary"), // Remove trailing \r\n
          };
        } else {
          // It's a field
          const value = bodyPart.slice(0, -2); // Remove trailing \r\n
          result.fields[fieldName] = value;
        }
      }
    }
  });

  return result;
}

/**
 * Parses the headers from a multipart section.
 * @param headerString The header string.
 * @returns An object representing the parsed headers.
 */
function parseHeaders(headerString: string): { [key: string]: string } {
  const headers: { [key: string]: string } = {};
  const lines = headerString.split("\r\n");
  for (const line of lines) {
    const [key, value] = line.split(": ");
    if (key && value) {
      headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

/**
 * Splits a string into two parts at the first occurrence of a separator.
 * @param str The string to split.
 * @param separator The separator string.
 * @returns An array containing the two parts.
 */
function splitBuffer(
  str: string,
  separator: string
): [string, string] | [null, null] {
  const index = str.indexOf(separator);
  if (index === -1) return [null, null];
  const part1 = str.substring(0, index);
  const part2 = str.substring(index + separator.length);
  return [part1, part2];
}
