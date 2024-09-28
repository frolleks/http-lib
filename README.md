# Pathless

A lightweight, flexible routing library for JavaScript. Designed for simplicity, Pathless provides an intuitive API for handling HTTP requests and organizing your routes.

```js
// CJS
const pathless = require("pathless");
// ESM
import pathless from "pathless";

const app = pathless();

app.get("/", (req, res) => res.send("Hello world!"));

app.listen(3000, () => console.log("Server is listening on port 3000"));
```

## Features

- **Flexible Routing**: Easily define routes for various HTTP methods, including support for dynamic and wildcard routes.
- **Middleware Support**: Add global or route-specific middleware to handle tasks like authentication, logging, and more.
- **Modular Routers**: Organize your application into reusable routers for better scalability and maintainability.

## Quick Start

```bash
$ npm i pathless@latest
$ yarn add pathless@latest
$ pnpm i pathless@latest
```

## Comparison with other frameworks

| Stat        | Framework | 1%     | 2.5%   | 50%    | 97.5%  | Avg       | Stdev    | Min    |
| ----------- | --------- | ------ | ------ | ------ | ------ | --------- | -------- | ------ |
| **Req/Sec** | Pathless  | 27,215 | 27,215 | 32,447 | 33,983 | 31,973.82 | 1,827.87 | 27,214 |
|             | Express   | 6,451  | 6,451  | 8,279  | 8,495  | 8,023.82  | 609.14   | 6,451  |
|             | Hono      | 28,079 | 28,079 | 34,399 | 35,327 | 33,888.73 | 1,882.39 | 28,065 |

(from [frolleks/nodejs-http-framework-benchmark](https://github.com/frolleks/nodejs-http-framework-benchmark))

## Documentation

Visit the [repository's Wiki](https://github.com/frolleks/pathless/wiki).

## License

MIT License
