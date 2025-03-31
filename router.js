const fs = require("fs/promises");
const path = require("path");

const multer = require("@koa/multer");
const upload = multer();

const Router = require("@koa/router");
const page = new Router();


const { getTemplateHeader, getApi } = require("./utils");

page.get("/", async (ctx) => {
  const filePath = path.resolve(__dirname, "index.html");
  const file = await fs.readFile(filePath);
  const html = file.toString();
  ctx.body = html;
});

const cmdParams = process.argv.slice(2);

page.post("/upload", upload.single('file'), async (ctx) => {
  try {
    const json = JSON.parse(ctx.file.buffer.toString());

    let str = "";
    const baseUrl = json.servers[0].url;
    str += getTemplateHeader({ baseUrl });

    const paths = Object.keys(json.paths);

    paths.forEach((path) => {
      const info = json.paths[path];
      const method = info["get"] ? "get" : "post";

      const template = getApi({ path, method, ...info[method] });

      str += `${template} \n`;
    })

    let outPath = path.resolve(__dirname, "api.js");
    const index = cmdParams.indexOf("--o");
    if (index > -1) {
      const _path = cmdParams[index + 1];
      if (!_path.startsWith("--")) {
        outPath = path.resolve(_path, "api.js");
      }
    }
    await fs.writeFile(outPath, str);
    ctx.body = str;

  } catch (e) {
    console.error(e);
  }
});

module.exports = page;