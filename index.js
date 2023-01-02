module.exports = (homebridge) => {
  const { HygrothermographWrapper } = require("./lib/accessory")(homebridge);
  homebridge.registerAccessory(
    "homebridge-hygrothermograph-wrapper",
    "Hygrotermograph",
    HygrothermographWrapper
  );
};
