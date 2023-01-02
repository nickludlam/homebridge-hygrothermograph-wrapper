# homebridge-hygrothermograph-wrapper

This is a very basic, hacked together Homebridge plugin that pulls data from the Xaomi Mi Bluetooth temperature and humidity sensor. In particular this is set up to use the custom firmware from [pvvx](https://github.com/pvvx/ATC_MiThermometer).

The [standard plugin from hanneseman](https://github.com/hannseman/homebridge-mi-hygrothermograph) would not work for me, and I think that is related to the [noble](https://www.npmjs.com/package/@abandonware/noble) library basically being abandonware, and not being compatible with more recent versions of Bluez, which has moved to DBus being the preferred way of pulling data.

This is a very much stripped down plugin, and it's currently very basic, and only supports one instance. It's more of a proof of concept than a long term plugin. This should ideally be using the newer dynamic plugin architecture.

## Architecture

The plugin will spawn a python process on startup. This python code will listen for advertising broadcasts from any bluetooth device supporting environmental sensing data. It will then print this data to stdout. The node plugin wrapper will pull the data into the Homebridge environment.

There is a simple pid file that's created to ensure previous invocations are tidied up upon a restart.

# Requirements

The Python3 script requires [Bleak](https://bleak.readthedocs.io/en/latest/) and [Construct](https://construct.readthedocs.io/en/latest/).

## Todo

- Filter based on MAC address
- Present multiple devices as independent sensors to Homebridge
- Monitor and restart the python code if it stops working
- Handle a non-active Bluez/Bluetooth environment
- Move plugin to Homebridge dynamic plugin architecture

