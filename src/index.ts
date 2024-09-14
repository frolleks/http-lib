import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";

interface RequestExtensions {
  query?: { [key: string]: string };
  pathname?: string;
  params?: { [key: string]: string };
  body?: any;
  files?: { [key: string]: UploadedFile };
}

interface UploadedFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

interface ResponseExtensions {
  send: (body: any) => void;
  json: (data: any) => void;
  sendFile: (filePath: string) => void;
}

type MiddlewareFunction = (
  req: http.IncomingMessage & RequestExtensions,
  res: http.ServerResponse & ResponseExtensions,
  next: (err?: any) => void
) => void;

type RouteHandler = (
  req: http.IncomingMessage & RequestExtensions,
  res: http.ServerResponse & ResponseExtensions
) => void;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

interface App {
  (req: http.IncomingMessage, res: http.ServerResponse): void;
  use: (middleware: MiddlewareFunction) => void;
  listen: (port: number, callback?: () => void) => http.Server;
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  put: (path: string, handler: RouteHandler) => void;
  delete: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}

/**
 * Creates an application instance with routing and middleware support.
 * @returns An application function that can handle HTTP requests.
 */
function createApp(): App {
  // Include bodyParser middleware by default
  const middlewares: MiddlewareFunction[] = [bodyParser];
  const routes: Route[] = [];

  const app = function (req: http.IncomingMessage, res: http.ServerResponse) {
    // Enhance the req and res objects
    const reqExt = req as http.IncomingMessage & RequestExtensions;
    const resExt = res as http.ServerResponse & ResponseExtensions;
    enhanceResponse(resExt);

    const method = req.method || "GET";

    const parsedUrl = new url.URL(req.url || "", `http://${req.headers.host}`);
    reqExt.query = Object.fromEntries(parsedUrl.searchParams.entries());
    reqExt.pathname = parsedUrl.pathname;

    let idx = 0;

    function next(err?: any): void {
      if (err) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }

      if (idx < middlewares.length) {
        const middleware = middlewares[idx++];
        middleware(reqExt, resExt, next);
      } else {
        const route = routes.find((r) => {
          if (r.method !== method) return false;
          const params = matchPath(r.path, reqExt.pathname || "");
          if (params) {
            reqExt.params = params;
            return true;
          }
          return false;
        });

        if (route) {
          route.handler(reqExt, resExt);
        } else {
          res.statusCode = 404;
          res.end("Not Found");
        }
      }
    }

    next();
  } as App;

  app.use = function (middleware: MiddlewareFunction): void {
    middlewares.push(middleware);
  };

  ["GET", "POST", "PUT", "DELETE", "PATCH"].forEach((method) => {
    (app as any)[method.toLowerCase()] = function (
      path: string,
      handler: RouteHandler
    ): void {
      routes.push({ method, path, handler });
    };
  });

  app.listen = function (port: number, callback?: () => void): http.Server {
    const server = http.createServer(app);
    return server.listen(port, callback);
  };

  return app;
}

/**
 * Matches the request path to the route path and extracts parameters.
 * @param routePath The route path with optional parameters (e.g., '/users/:id').
 * @param reqPath The actual request path (e.g., '/users/123').
 * @returns An object containing route parameters if matched, otherwise null.
 */
function matchPath(
  routePath: string,
  reqPath: string
): { [key: string]: string } | null {
  const routeSegments = routePath.split("/").filter(Boolean);
  const reqSegments = reqPath.split("/").filter(Boolean);

  if (routeSegments.length !== reqSegments.length) {
    return null;
  }

  const params: { [key: string]: string } = {};

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const reqSegment = reqSegments[i];

    if (routeSegment.startsWith(":")) {
      const paramName = routeSegment.slice(1);
      params[paramName] = reqSegment;
    } else if (routeSegment !== reqSegment) {
      return null;
    }
  }

  return params;
}

/**
 * Enhances the response object with helper methods.
 * @param res The HTTP ServerResponse object.
 */
function enhanceResponse(res: http.ServerResponse & ResponseExtensions): void {
  /**
   * Sends a response to the client.
   * @param body The response body.
   */
  res.send = function (body: any): void {
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      res.setHeader("Content-Type", "text/html");
      res.end(body);
    } else if (typeof body === "object") {
      res.json(body);
    } else {
      res.end();
    }
  };

  /**
   * Sends a JSON response to the client.
   * @param data The data to be serialized to JSON.
   */
  res.json = function (data: any): void {
    const jsonData = JSON.stringify(data);
    res.setHeader("Content-Type", "application/json");
    res.end(jsonData);
  };

  /**
   * Sends a file as a response to the client.
   * @param filePath The path to the file to be sent.
   */
  res.sendFile = function (filePath: string): void {
    const absolutePath = path.resolve(filePath);
    fs.stat(absolutePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end("File Not Found");
        return;
      }

      const readStream = fs.createReadStream(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeType = getMimeType(ext);

      res.setHeader("Content-Type", mimeType);
      readStream.pipe(res);
    });
  };
}

/**
 * Returns the MIME type based on the file extension.
 * @param ext The file extension.
 * @returns The corresponding MIME type.
 */
function getMimeType(ext: string): string {
  const mimeTypes: { [key: string]: string } = {
    ".html": "text/html",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    // Add more MIME types as needed
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Middleware to parse the request body and populate req.body and req.files.
 * @param req The HTTP IncomingMessage object.
 * @param res The HTTP ServerResponse object.
 * @param next The next middleware function.
 */
function bodyParser(
  req: http.IncomingMessage & RequestExtensions,
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

export default createApp;
