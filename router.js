const fs = require("fs/promises");
const path = require("path");

const multer = require("@koa/multer");
const upload = multer();

const Router = require("@koa/router");
const page = new Router();


const { getRequestFile } = require("./utils/request");

page.get("/", async (ctx) => {
  const filePath = path.resolve(__dirname, "index.html");
  const file = await fs.readFile(filePath);
  const html = file.toString();
  ctx.body = html;
});

let json;

page.post("/upload", upload.single('file'), async (ctx) => {
  try {
    const body = ctx.request.body;
    json = JSON.parse(ctx.file.buffer.toString());
    ctx.body = JSON.stringify(json.paths);
  } catch (e) {
    console.error(e);
  }
});

page.post("/parse", async (ctx) => {
  try {
    const body = ctx.request.body;
    const options = {};
    options.prefix = !!body.prefix;
    options.suffix = body.suffix;

    const paths = {};

    body.paths.forEach(key => {
      paths[key] = json.paths[key];
    })

    const str = await getRequestFile({
      ...json,
      paths,
    }, options);

    ctx.body = str;
  } catch (e) {
    console.error(e);
  }
});

module.exports = page;