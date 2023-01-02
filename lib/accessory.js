const { Wrapper } = require("./wrapper");
const { version } = require("../package.json");

let Service;
let Characteristic;
let homebridgeAPI;

const defaultTimeout = 15;

class HygrothermographWrapper {
  constructor(log, config) {
    this.log = log;
    this.config = config || {};
    this.type = "Hygrotermograph";
    this.displayName = this.config.name;

    this.latestTemperature = undefined;
    this.latestHumidity = undefined;
    this.latestBatteryLevel = undefined;
    this.lastUpdatedAt = undefined;
    
    this.informationService = this.getInformationService();
    this.batteryService = this.getBatteryService();
    this.humidityService = this.getHumidityService();
    this.temperatureService = this.getTemperatureService();

    this.wrapper = this.setupWrapper();

    this.log.info(`Initialized accessory of type ${this.type}`);
  }

  setTemperature(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestTemperature = newValue;
    this.lastUpdatedAt = Date.now();
    this.temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .updateValue(newValue);
  }

  get temperature() {
    if (this.hasTimedOut() || this.latestTemperature == null) {
      return;
    }
    return this.latestTemperature + this.temperatureOffset;
  }

  setHumidity(newValue, force = false) {
    if (newValue == null || this.humidityService == null) {
      return;
    }
    this.latestHumidity = newValue;
    this.lastUpdatedAt = Date.now();
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .updateValue(newValue);
  }

  get humidity() {
    if (this.hasTimedOut() || this.latestHumidity == null) {
      return;
    }
    return this.latestHumidity + this.humidityOffset;
  }

  get lastUpdatedISO8601() {
    return new Date(this.lastUpdatedAt).toISOString();
  }

  get timeout() {
    return this.config.timeout == null ? defaultTimeout : this.config.timeout;
  }

  get temperatureName() {
    return this.config.temperatureName || "Temperature";
  }

  get humidityName() {
    return this.config.humidityName || "Humidity";
  }

  get temperatureOffset() {
    return this.config.temperatureOffset || 0;
  }

  get humidityOffset() {
    return this.config.humidityOffset || 0;
  }

  setBatteryLevel(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestBatteryLevel = newValue;
    this.lastUpdatedAt = Date.now();
    if (this.batteryService != null) {
      this.batteryService
        .getCharacteristic(Characteristic.BatteryLevel)
        .updateValue(newValue);
    }
  }

  get batteryLevel() {
    if (this.hasTimedOut()) {
      return;
    }
    return this.latestBatteryLevel;
  }

  get batteryStatus() {
    let batteryStatus;
    if (this.batteryLevel == null) {
      batteryStatus = undefined;
    } else if (this.batteryLevel > this.batteryLevelThreshold) {
      batteryStatus = Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    } else {
      batteryStatus = Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }
    return batteryStatus;
  }

  get batteryLevelThreshold() {
    return this.config.lowBattery || 10;
  }

  hasTimedOut() {
    if (this.timeout === 0) {
      return false;
    }
    if (this.lastUpdatedAt == null) {
      return false;
    }
    const timeoutMilliseconds = 1000 * 60 * this.timeout;
    const timedOut = this.lastUpdatedAt <= Date.now() - timeoutMilliseconds;
    if (timedOut) {
      this.log.warn(
        `Timed out, last update: ${this.lastUpdatedISO8601}`
      );
    }
    return timedOut;
  }

  setupWrapper() {
    // TODO: Use address to filter the incoming data from the python wrapper
    const address = this.config.address;
    const wrapper = new Wrapper(this.config.address, {log: this.log});
    wrapper.on("data", (temperature, humidity, battery, source_address) => {
      //this.log.info(`Temperature: ${temperature}c / Humidity: ${humidity} / Battery: ${battery}`);
      this.setTemperature(temperature);
      this.setHumidity(humidity);
      this.setBatteryLevel(battery);
    });
  }

  getInformationService() {
    let manufacturer = "Cleargrass Inc";
    let model = "LYWSDCGQ01ZM";
    const accessoryInformation = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, manufacturer)
      .setCharacteristic(Characteristic.Model, model)
      .setCharacteristic(Characteristic.FirmwareRevision, version);
    if (this.serialNumber != null) {
      accessoryInformation.setCharacteristic(
        Characteristic.SerialNumber,
        this.serialNumber
      );
    }
    return accessoryInformation;
  }

  onCharacteristicGetValue(field, callback) {
    const value = this[field];
    if (value == null) {
      callback(new Error(`Undefined characteristic value for ${field}`));
    } else {
      callback(null, value);
    }
  }

  getTemperatureService() {
    const temperatureService = new Service.TemperatureSensor(
      this.temperatureName
    );
    temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on("get", this.onCharacteristicGetValue.bind(this, "temperature"));
    temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ minValue: -40 });
    temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({ maxValue: 60 });
    return temperatureService;
  }

  getHumidityService() {
    const humidityService = new Service.HumiditySensor(this.humidityName);
    humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on("get", this.onCharacteristicGetValue.bind(this, "humidity"));
    return humidityService;
  }

  getBatteryService() {
    const batteryService = new Service.BatteryService("Battery");
    batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .on("get", this.onCharacteristicGetValue.bind(this, "batteryLevel"));
    batteryService.setCharacteristic(
      Characteristic.ChargingState,
      Characteristic.ChargingState.NOT_CHARGEABLE
    );
    batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on("get", this.onCharacteristicGetValue.bind(this, "batteryStatus"));
    return batteryService;
  }

  getServices() {
    let services = [
      this.informationService,
      this.batteryService,
    ];
    services.push(this.temperatureService, this.humidityService);
    return services.filter(Boolean);
  }
}
module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridgeAPI = homebridge;
  return { HygrothermographWrapper };
};

