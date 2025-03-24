const Koa = require("koa");
const app = new Koa();

const { bodyParser } = require("@koa/bodyparser");
app.use(bodyParser());

const multer = require("@koa/multer");
const upload = multer();

const Router = require("@koa/router");
const page = new Router();
app.use(page.routes());

const fs = require("fs/promises");
const path = require("path");

page.get("/", async (ctx) => {
  const filePath = path.resolve(__dirname, "index.html");
  const file = await fs.readFile(filePath);
  const html = file.toString();
  ctx.body = html;
});

const getTemplateHeader = (info) => {
  return `
const baseUrl = "${info.baseUrl}";
`
};

const getApi = (params) => {
  const method = params.method;

  let payload = method === "get" ? "{ params }" : "params";

  return `
/**
 * ${params.summary || "请补充描述..."}
 * @param {*} params 
 * @returns 
 */
export const ${params.operationId} = async (params) => {
  const response = await axiosInstance.${method}(\`\${baseUrl}${params.path}\`, ${payload});

  return response;
};
`
};

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
})

app.listen(3000, () => {
  console.log("启动成功")
})