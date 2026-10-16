import app from "./src/server/index.js";

const port = process.env.PORT || 7700;
app.listen(port, () => {
  console.log(`http://127.0.0.1:${port}/manifest.json`);
});
