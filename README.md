# Pathless

An http router for Node.js. Mostly made by OpenAI's o1. Let's see how good this can be.

## Quick Start

Installation:

```bash
npm i pathless
```

Usage:

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

## License

MIT License
