const EventEmitter = require("events");
const fs = require('fs');
const os = require("os");
const { spawn } = require('node:child_process');

class Wrapper extends EventEmitter {
  constructor(address, options) {
    super();
    options = options || {};
    const {
      log = console,
    } = options;
    this.log = log;
    this.address = address;
    this.pyprog = undefined;

    // crude previous pid checking
    const tempDir = os.tmpdir();
    this.pidFilePath = tempDir + '/pvvx_hygrothermograph_sniffer_pid';
    if (fs.existsSync(this.pidFilePath)) {
      const oldPid = fs.readFileSync(this.pidFilePath, 'utf8');
      process.kill(oldPid, 'SIGINT');
      fs.unlinkSync(this.pidFilePath);
      this.log.info(`Killing old pid ${oldPid} and removed ${this.pidFilePath}`);
    }

    this.configure();
  }
  
  configure() {
    var currentenv = Object.create(process.env);
    this.pyprog = spawn('/usr/bin/python3', [__dirname + "/../pvvx_hygrothermograph_sniffer.py"], {env: currentenv});

    if (this.pyprog.pid) {
      var pidFile = fs.createWriteStream(this.pidFilePath);
      pidFile.write(this.pyprog.pid.toString());
      pidFile.end();
    }

    this.log.info(`Spawned Python process ${this.pyprog.pid} and wrote to ${this.pidFilePath}`);

    this.pyprog.stdout.on('data', (data) => {
      var dataStr = data.toString();
      var trimData = dataStr.trim();
      var dataElements = trimData.split('/');
      // mac / name / rssi / temperature / humidity / battery
      this.emit('data', dataElements[3], dataElements[4], dataElements[5], dataElements[0]);
    });

    this.pyprog.stderr.on('data', (data) => {
      this.log.error(`${data}`);
    });

    this.pyprog.on('close', (code) => {
      this.log.info(`Child process exited with code ${code}`);
    });
  }
}

module.exports = { Wrapper };
