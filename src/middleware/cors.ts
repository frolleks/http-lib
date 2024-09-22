import {
  MiddlewareFunction,
  PathlessRequest,
  PathlessResponse,
} from "../index.js";

/**
 * CORS Middleware to handle Cross-Origin Resource Sharing.
 * @param options Options for configuring CORS headers.
 */
function cors(options?: {
  origin?: string;
  methods?: string;
  allowedHeaders?: string;
  exposedHeaders?: string;
  credentials?: boolean;
  maxAge?: number;
}): MiddlewareFunction {
  return function (
    req: PathlessRequest,
    res: PathlessResponse,
    next: (err?: any) => void
  ) {
    const {
      origin = "*",
      methods = "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      allowedHeaders = "Content-Type, Authorization, X-Requested-With",
      exposedHeaders = "",
      credentials = false,
      maxAge = 86400, // 24 hours
    } = options || {};

    // Set the basic CORS headers
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);

    if (exposedHeaders) {
      res.setHeader("Access-Control-Expose-Headers", exposedHeaders);
    }

    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (maxAge) {
      res.setHeader("Access-Control-Max-Age", maxAge.toString());
    }

    // If it's a preflight request (OPTIONS), respond and end the request
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

export { cors };
