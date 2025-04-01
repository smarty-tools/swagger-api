const fs = require('fs');
const path = require('path');
const open = require('open');

class KoaSingleton {
  constructor(port) {
    this.port = port;
    this.lockFile = path.join(__dirname, '.koa.lock');
  }

  // 检查服务是否已运行
  checkExisting() {
    try {
      if (!fs.existsSync(this.lockFile)) return false;
      
      const pid = Number(fs.readFileSync(this.lockFile, 'utf8'));
      process.kill(pid, 0); // 检查进程是否存在
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  // 打开浏览器
  openBrowser() {
    open(`http://localhost:${this.port}`).catch(() => {
      console.log('自动打开浏览器失败，请手动访问');
    });
  }

  // 创建锁文件
  createLock() {
    fs.writeFileSync(this.lockFile, String(process.pid));
    process.on('exit', this.cleanup); // 进程退出时清理
    process.on('SIGINT', this.cleanup); // Ctrl+C
  }

  // 清理锁文件
  cleanup = () => {
    if (fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
    }

    process.kill(process.pid);
  }
}

module.exports = KoaSingleton;