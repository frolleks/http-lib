import * as http from "http";
import * as url from "url";
import * as qs from "querystring";
import * as fs from "fs";
import * as path from "path";

import type { UploadedFile } from "./middleware/bodyParser";
import { bodyParser } from "./middleware";

interface PathlessRequest extends http.IncomingMessage {
  query?: { [key: string]: any };
  pathname?: string;
  params?: { [key: string]: string };
  body?: any;
  files?: { [key: string]: UploadedFile };
}

interface PathlessResponse extends http.ServerResponse {
  status: (statusCode: number) => PathlessResponse;
  send: (body: any) => void;
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

interface App {
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
}

/**
 * Helper function to create the `use` function for both the app and router.
 * This function registers middleware or a router on a specific path.
 */
function createUseFunction(
  middlewares: MiddlewareFunction[],
  routes: any[] // Can be Route[] or Router[]
) {
  return function (
    pathOrMiddleware: string | MiddlewareFunction,
    routerOrMiddleware?: Router | MiddlewareFunction
  ): void {
    if (typeof pathOrMiddleware === "string" && routerOrMiddleware) {
      const path = pathOrMiddleware;
      const handler = routerOrMiddleware;

      if ("routes" in handler && "middlewares" in handler) {
        // It's a router
        const router = handler as Router;

        // Adjust the routes
        router.routes.forEach((route) => {
          const fullPath = path + (route.path === "/" ? "" : route.path);
          routes.push({
            method: route.method,
            path: fullPath,
            handler: route.handler,
          });
        });

        // Adjust middlewares
        router.middlewares.forEach((middleware) => {
          middlewares.push((req, res, next) => {
            if (req.pathname && req.pathname.startsWith(path)) {
              middleware(req, res, next);
            } else {
              next();
            }
          });
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
      const middleware = pathOrMiddleware;
      middlewares.push(middleware);
    } else {
      throw new Error("Invalid arguments to use function");
    }
  };
}

/**
 * Generates route methods (get, post, put, delete, patch) for a given object
 * and attaches them to the provided `routes` array.
 *
 * @param obj The object (e.g., app or router) to attach the route methods to.
 * @param routes The array where the routes will be stored.
 */
function createRouteMethods(obj: any, routes: Route[]) {
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

  methods.forEach((method) => {
    obj[method.toLowerCase()] = function (
      path: string,
      handler: RouteHandler
    ): void {
      routes.push({ method, path, handler });
    };
  });
}

/**
 * Creates an application instance with routing and middleware support.
 * @returns An application function that can handle HTTP requests.
 */
function createApp(): App {
  const middlewares: MiddlewareFunction[] = [bodyParser];
  const routes: Route[] = [];

  const app = function (req: http.IncomingMessage, res: http.ServerResponse) {
    const reqExt = req as PathlessRequest;
    const resExt = res as PathlessResponse;
    enhanceResponse(resExt);

    const method = req.method || "GET";

    const parsedUrl = new url.URL(req.url || "", `http://${req.headers.host}`);
    reqExt.query = qs.parse(parsedUrl.searchParams.toString() || "");
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

  app.use = createUseFunction(middlewares, routes);
  createRouteMethods(app, routes);

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
  const middlewares: MiddlewareFunction[] = [];
  const routes: Route[] = [];

  const router: Partial<Router> = {
    routes,
    middlewares,
  };

  router.use = createUseFunction(middlewares, routes);
  createRouteMethods(router, routes);

  return router as Router;
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
  const params: { [key: string]: string } = {};

  let routeIndex = 0;
  let reqIndex = 0;

  while (routeIndex < routePath.length && reqIndex < reqPath.length) {
    // Skip over any leading '/' characters
    while (routePath[routeIndex] === "/") routeIndex++;
    while (reqPath[reqIndex] === "/") reqIndex++;

    // If we have reached the end of either path, break
    if (routeIndex >= routePath.length || reqIndex >= reqPath.length) break;

    // Find the next '/' in both paths
    const nextRouteSlash = routePath.indexOf("/", routeIndex);
    const nextReqSlash = reqPath.indexOf("/", reqIndex);

    const routeSegment = routePath.slice(
      routeIndex,
      nextRouteSlash === -1 ? undefined : nextRouteSlash
    );
    const reqSegment = reqPath.slice(
      reqIndex,
      nextReqSlash === -1 ? undefined : nextReqSlash
    );

    // If the segment starts with ':', it's a parameter
    if (routeSegment[0] === ":") {
      const paramName = routeSegment.slice(1); // Remove the leading ':'
      params[paramName] = reqSegment; // Assign the corresponding request segment to the parameter name
    } else if (routeSegment !== reqSegment) {
      return null; // If a non-parameter segment doesn't match, paths don't match
    }

    // Move to the next segment
    routeIndex = nextRouteSlash === -1 ? routePath.length : nextRouteSlash;
    reqIndex = nextReqSlash === -1 ? reqPath.length : nextReqSlash;
  }

  // Handle case where one path is longer than the other
  if (routeIndex < routePath.length || reqIndex < reqPath.length) {
    return null;
  }

  return params;
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
    // Check if the Content-Type header is already set
    if (!res.hasHeader("Content-Type")) {
      // Set default Content-Type based on the body type
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        throw new Error(
          "Content-Type header is required when sending string or buffer data."
        );
      } else if (typeof body === "object") {
        throw new Error(
          "Content-Type header is required when sending JSON data."
        );
      }
    }

    if (typeof body === "string" || Buffer.isBuffer(body)) {
      res.end(body);
    } else if (typeof body === "object") {
      res.json(body);
    } else {
      res.end();
    }
  };

  /**
   * Sends an HTML response to the client.
   * @param body The response body.
   */
  res.html = function (body: string): void {
    res.setHeader("Content-Type", "text/html");
    res.end(body);
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

export {
  createApp,
  createRouter,
  type MiddlewareFunction,
  type Router,
  type Route,
  type PathlessRequest,
  type PathlessResponse,
  type RouteHandler,
};
