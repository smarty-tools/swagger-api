const Koa = require("koa");
const app = new Koa();

const { bodyParser } = require("@koa/bodyparser");
app.use(bodyParser());


const page = require("./router");

app.use(page.routes());

const port = 3001;
app.listen(port, () => {
  console.log("启动成功");
})