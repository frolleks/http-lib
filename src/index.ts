import * as http from "http";
import * as url from "url";
import * as qs from "querystring";
import * as fs from "fs";
import * as path from "path";

import findMyWay, {
  HTTPVersion,
  HTTPMethod,
  Instance as FindMyWayInstance,
} from "find-my-way";

import { bodyParser, type UploadedFile } from "./middleware/bodyParser.js";

interface PathlessRequest extends http.IncomingMessage {
  query?: { [key: string]: any };
  pathname?: string;
  params?: { [key: string]: string | undefined };
  body?: any;
  files?: { [key: string]: UploadedFile };
}

interface PathlessResponse extends http.ServerResponse {
  status: (statusCode: number) => PathlessResponse;
  send: (body: any) => void;
  sendStatus: (statusCode: number) => void;
  text: (body: string) => void;
  html: (body: string) => void;
  json: (data: any) => void;
  sendFile: (filePath: string) => void;
}

type MiddlewareFunction = (
  req: PathlessRequest,
  res: PathlessResponse,
  next: (err?: any) => void
) => void;

type RouteHandler = (req: PathlessRequest, res: PathlessResponse) => void;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

interface PathlessInstance {
  (req: http.IncomingMessage, res: http.ServerResponse): void;
  use(middleware: MiddlewareFunction): void;
  use(path: string, routerOrMiddleware: Router | MiddlewareFunction): void;
  listen: (port: number, callback?: () => void) => http.Server;
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  put: (path: string, handler: RouteHandler) => void;
  delete: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}

interface Router {
  use(middleware: MiddlewareFunction): void;
  use(path: string, middleware: MiddlewareFunction): void;
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  put: (path: string, handler: RouteHandler) => void;
  delete: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
  routes: Route[];
  middlewares: MiddlewareFunction[];
  handle: (req: http.IncomingMessage, res: http.ServerResponse) => void;
}

/**
 * Shared function to create an instance with middlewares and a router.
 * This function is used by both createApp and createRouter to avoid code duplication.
 */
function createInstance() {
  const middlewares: MiddlewareFunction[] = [];
  const routerInstance = findMyWay<HTTPVersion.V1>();

  function handler(req: http.IncomingMessage, res: http.ServerResponse): void {
    const reqExt = req as PathlessRequest;
    const resExt = res as PathlessResponse;
    enhanceResponse(resExt);

    if (!reqExt.pathname) {
      const parsedUrl = new url.URL(
        req.url || "",
        `http://${req.headers.host}`
      );
      reqExt.query = qs.parse(parsedUrl.searchParams.toString() || "");
      reqExt.pathname = parsedUrl.pathname;
    }

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
        routerInstance.lookup(reqExt, resExt);
      }
    }

    next();
  }

  return { middlewares, routerInstance, handler };
}

/**
 * Helper function to create the `use` function for both the app and router.
 * This function registers middleware or a router on a specific path using find-my-way.
 */
function createUseFunction(
  middlewares: MiddlewareFunction[],
  router: FindMyWayInstance<HTTPVersion.V1>
) {
  return function (
    pathOrMiddleware: string | MiddlewareFunction,
    routerOrMiddleware?: Router | MiddlewareFunction
  ): void {
    if (typeof pathOrMiddleware === "string" && routerOrMiddleware) {
      const path = pathOrMiddleware;
      const handler = routerOrMiddleware;

      if ("handle" in handler && typeof handler.handle === "function") {
        // It's a Router instance
        // Mount the router on the specified path
        router.all(`${path}/*`, (req, res, params) => {
          const reqExt = req as PathlessRequest;
          const resExt = res as PathlessResponse;

          const originalUrl = reqExt.url || "";
          reqExt.url = originalUrl.substring(path.length) || "/";
          reqExt.pathname = reqExt.url;
          reqExt.params = { ...reqExt.params, ...params };
          handler.handle(reqExt, resExt);
        });
      } else if (typeof handler === "function") {
        // It's middleware
        middlewares.push((req, res, next) => {
          if (req.pathname && req.pathname.startsWith(path)) {
            handler(req, res, next);
          } else {
            next();
          }
        });
      } else {
        throw new Error("Invalid arguments to use function");
      }
    } else if (typeof pathOrMiddleware === "function") {
      // Global middleware
      const middleware = pathOrMiddleware;
      middlewares.push(middleware);
    } else {
      throw new Error("Invalid arguments to use function");
    }
  };
}

/**
 * Generates route methods (get, post, put, delete, patch) for a given object
 * and attaches them to the provided router instance.
 *
 * @param obj The object (e.g., app or router) to attach the route methods to.
 * @param router The find-my-way router instance.
 */
function createRouteMethods(
  obj: any,
  router: FindMyWayInstance<HTTPVersion.V1>
) {
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

  methods.forEach((method) => {
    obj[method.toLowerCase()] = function (
      path: string,
      handler: RouteHandler
    ): void {
      router.on(method as HTTPMethod, path, (req, res, params) => {
        const reqExt = req as PathlessRequest;
        const resExt = res as PathlessResponse;
        reqExt.params = params;
        handler(reqExt, resExt);
      });
    };
  });
}

/**
 * Creates an application instance with routing and middleware support.
 * @returns An application function that can handle HTTP requests.
 */
function createApp(): PathlessInstance {
  const { middlewares, routerInstance, handler } = createInstance();

  // Add default middleware
  middlewares.push(bodyParser);

  const app = function (req: http.IncomingMessage, res: http.ServerResponse) {
    handler(req, res);
  } as PathlessInstance;

  app.use = createUseFunction(middlewares, routerInstance);
  createRouteMethods(app, routerInstance);

  app.listen = function (port: number, callback?: () => void): http.Server {
    const server = http.createServer(app);
    return server.listen(port, callback);
  };

  return app;
}

/**
 * Creates a Router instance for modular route handling.
 * This router supports middleware and RESTful route methods like GET, POST, etc.
 * @returns A Router object with methods similar to the main app.
 */
function createRouter(): Router {
  const { middlewares, routerInstance, handler } = createInstance();

  const routes: Route[] = [];

  const router: Partial<Router> = {
    routes,
    middlewares,
    handle: handler,
  };

  router.use = createUseFunction(middlewares, routerInstance);
  createRouteMethods(router, routerInstance);

  return router as Router;
}

/**
 * Enhances the response object with helper methods.
 * @param res The HTTP ServerResponse object.
 */
function enhanceResponse(res: PathlessResponse): void {
  /**
   * Sets an HTTP status code for the response.
   * @param statusCode The status code.
   */
  res.status = function (statusCode: number) {
    res.statusCode = statusCode;
    return res; // Return `res` to allow method chaining
  };

  /**
   * Sends a response to the client.
   * @param body The response body.
   */
  res.send = function (body: any): void {
    // If no body is provided, send an empty response
    if (body === undefined || body === null) {
      res.end();
      return;
    }

    if (typeof body === "string") {
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.setHeader("Content-Length", Buffer.byteLength(body));
      res.end(body);
    } else if (Buffer.isBuffer(body)) {
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/octet-stream");
      }
      res.setHeader("Content-Length", body.length);
      res.end(body);
    } else if (typeof body === "object") {
      this.json(body);
    } else if (typeof body === "number") {
      const numStr = body.toString();
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.setHeader("Content-Length", Buffer.byteLength(numStr));
      res.end(numStr);
    } else {
      const strBody = String(body);
      if (!res.hasHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.setHeader("Content-Length", Buffer.byteLength(strBody));
      res.end(strBody);
    }
  };

  /**
   * Sends a blank response body with an HTTP status code.
   * @param statusCode The status code.
   */
  res.sendStatus = function (statusCode: number) {
    res.statusCode = statusCode;
    res.end();
  };

  /**
   * Sends a plain text response to the client.
   * @param body The response body.
   */
  res.text = function (body: string): void {
    res.setHeader("Content-Type", "text/plain");
    res.end(body);
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

export default createApp;

export { createRouter };
export type {
  MiddlewareFunction,
  Router,
  Route,
  PathlessRequest,
  PathlessResponse,
  RouteHandler,
  PathlessInstance,
};
