import * as fs from "fs";
import createApp from "http-lib";

const app = createApp();

// Middleware example
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Route sending plain text
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Route sending JSON response
app.get("/api/data", (req, res) => {
  const data = { message: "Hello JSON", timestamp: Date.now() };
  res.json(data);
});

// Route serving an image
app.get("/image", (req, res) => {
  res.sendFile("./public/image.jpg");
});

// Route serving a video
app.get("/video", (req, res) => {
  res.sendFile("./public/video.mp4");
});

// Route with parameters
app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params?.id });
});

// Route handling JSON body
app.post("/api/data", (req, res) => {
  console.log(req.body); // Parsed JSON body
  res.json({ received: req.body });
});

// Route handling file upload
app.post("/upload", (req, res) => {
  console.log(req.body); // Form fields
  console.log(req.files); // Uploaded files

  // Save the file (for example)
  const file = req.files?.myfile;
  if (file) {
    fs.writeFileSync(`./uploads/${file.filename}`, file.data);
    res.json({ message: "File uploaded successfully" });
  } else {
    res.statusCode = 400;
    res.json({ error: "No file uploaded" });
  }
});

app.get("/query", (req, res) => {
  const param = req.query;

  res.send(param);
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
