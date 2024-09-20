# Pathless

An http router for Node.js. Mostly made by OpenAI's o1. Let's see how good this can be.

## Quick Start

```bash
$ npm i pathless
```

```js
// CJS
const { createApp } = require("pathless");
// ESM
import { createApp } from "pathless";

const app = createApp();

app.get("/", (req, res) => {
  res.json({ hello: "world" });
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
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
