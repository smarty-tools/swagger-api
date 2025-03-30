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


page.post("/upload", upload.single('file'), async (ctx) => {
  try {
    const json = JSON.parse(ctx.file.buffer.toString());


    let str = "";
    const baseUrl = json.servers[0].url;
    str += getTemplateHeader({ baseUrl })

    const paths = Object.keys(json.paths);
    console.log(paths.length)
    

    paths.forEach((path, index) => {
      const info = json.paths[path];
      const method = info["get"] ? "get" : "post";

      const template = getApi({ path, method, ...info[method] });

      str += `${template} \n`;
    })

    const filePath = path.resolve(__dirname, "api.js");
    await fs.writeFile(filePath, str);
    ctx.body = str;

  } catch (e) {
    console.error(e)
  }
});

module.exports = page;