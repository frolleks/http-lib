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
| **Req/Sec** | Pathless  | 29,279 | 29,279 | 34,591 | 35,295 | 34,154.91 | 1,595.32 | 29,279 |
|             | Express   | 8,255  | 8,255  | 9,991  | 10,183 | 9,806.19  | 522.69   | 8,251  |
|             | Hono      | 32,015 | 32,015 | 39,167 | 41,151 | 38,818.4  | 2,484.92 | 32,009 |

(from [frolleks/nodejs-http-framework-benchmark](https://github.com/frolleks/nodejs-http-framework-benchmark))

## Documentation

Visit the [repository's Wiki](https://github.com/frolleks/pathless/wiki).

## License

MIT License
