const Koa = require("koa");
const app = new Koa();

const { bodyParser } = require("@koa/bodyparser");
app.use(bodyParser());

const page = require("./router");
const getArgs = require("./utils/utils");

app.use(page.routes());

const Singleton = require("./singleton");

const parsed = getArgs(process.argv.slice(2));
const port = parsed.p ?? parsed.prot ?? 3000;

const singleton = new Singleton(port);

// 单例检查逻辑
if (singleton.checkExisting()) {
  console.log('服务已运行，自动跳转中...');
  singleton.openBrowser();
  process.exit(0);
}

// 启动服务
app.listen(port, () => {
  singleton.createLock();
  console.log(`Server running on http://localhost:${port}`);
  singleton.openBrowser();
});
