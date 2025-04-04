const fs = require("fs/promises");
const path = require("path");

const multer = require("@koa/multer");
const upload = multer();

const Router = require("@koa/router");
const page = new Router();


const { getTemplateHeader, getApi } = require("./utils");
const getArgs = require("./utils/utils");

page.get("/", async (ctx) => {
  const filePath = path.resolve(__dirname, "index.html");
  const file = await fs.readFile(filePath);
  const html = file.toString();
  ctx.body = html;
});

const parsed = getArgs(process.argv.slice(2));

page.post("/upload", upload.single('file'), async (ctx) => {
  try {
    const body = ctx.request.body;
    const options = {};
    options.prefix = !!body.prefix;

    const json = JSON.parse(ctx.file.buffer.toString());

    let str = "";
    const baseUrl = json.servers[0].url;
    str += getTemplateHeader({ baseUrl });

    const paths = Object.keys(json.paths);

    paths.forEach((path) => {
      const info = json.paths[path];
      const method = info["get"] ? "get" : "post";

      const template = getApi({ path, method, ...info[method] }, options);

      str += `${template} \n`;
    });

    let outPath = path.resolve(__dirname, "api.js");
    const _path = parsed.o;
    if (_path && typeof _path !== "boolean") {
      outPath = path.resolve(_path, "api.js");
    }

    await fs.writeFile(outPath, str);
    ctx.body = str;
  } catch (e) {
    console.error(e);
  }
});

module.exports = page;