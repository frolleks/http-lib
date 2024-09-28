import { PathlessRequest, PathlessResponse } from "../index.js";

/**
 * Parses the Cookie header and returns an object of key-value pairs.
 * @param cookieHeader The Cookie header string from the request.
 * @returns An object containing cookie key-value pairs.
 */
function parseCookies(cookieHeader: string): { [key: string]: string } {
  const cookies: { [key: string]: string } = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index > 0) {
      const key = decodeURIComponent(pair.substring(0, index).trim());
      const val = decodeURIComponent(pair.substring(index + 1).trim());
      cookies[key] = val;
    }
  }

  return cookies;
}

/**
 * Middleware to parse cookies from the request headers.
 * Adds a `cookies` property to the request object.
 * @param req The HTTP request object.
 * @param res The HTTP response object.
 * @param next The next middleware function.
 */
export function cookieParser(
  req: PathlessRequest,
  res: PathlessResponse,
  next: (err?: any) => void
): void {
  const cookieHeader = req.headers["cookie"];
  req.cookies = parseCookies(cookieHeader || "");
  next();
}
