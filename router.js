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

page.post("/upload", upload.single('file'), async (ctx) => {
  try {
    const body = ctx.request.body;
    const options = {};
    options.prefix = !!body.prefix;

    const json = JSON.parse(ctx.file.buffer.toString());
    const str = await getRequestFile(json, options);

    ctx.body = str;
  } catch (e) {
    console.error(e);
  }
});

module.exports = page;