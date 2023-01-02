"""Scan for Environmental Sensing data from custom firmware by pvvx on a Xiaomi Mijia LYWSD03MMC

 See https://github.com/pvvx/ATC_MiThermometer for more details

 Requires bleak and construct

"""
import asyncio
from uuid import UUID

from construct import Array, BitStruct, Flag, Padding, Byte, Const, Int8sl, Int16ul, Struct, Int16sl, Int8ul
from construct.core import ConstError

from bleak import BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

pvvx_extra_flag_bits = BitStruct(
    "reed_switch" / Flag,
    "gpio_trg" / Flag,
    "output_gpio_trg" / Flag,
    "temperature_triggered" / Flag,
    "humidity_triggered" / Flag,
    "padding" / Padding(3))

pvvx_payload_format = Struct(
    "mac" / Array(6, Byte),
    "temperature" / Int16sl,
    "humidity_percentage" / Int16ul,
    "battery_mv" / Int16ul,
    "battery_percent" / Int8ul,
    "frame_packet_counter" / Int8ul,
    "flags" / pvvx_extra_flag_bits)

environmental_sensing_service = '0000181a-0000-1000-8000-00805f9b34fb'

def device_found(
    device: BLEDevice, advertisement_data: AdvertisementData
):
    if environmental_sensing_service in advertisement_data.service_data and len(advertisement_data.service_data[environmental_sensing_service]) == 15:
        payload_length = len(advertisement_data.service_data[environmental_sensing_service])
        payload = pvvx_payload_format.parse(advertisement_data.service_data[environmental_sensing_service])
        mac_hex = ':'.join("%0x" % payload.mac[i] for i in range(0,6))
        # mac / name / rssi / temperature / humidity / battery
        print(f"{mac_hex}/{advertisement_data.local_name}/{device.rssi}/{float(payload.temperature) / 100.0}/{float(payload.humidity_percentage) / 100.0}/{payload.battery_percent}", flush=True)

async def main():
    """Scan for devices."""
    scanner = BleakScanner(detection_callback=device_found)
    #scanner.register_detection_callback(device_found)

    while True:
        await scanner.start()
        await asyncio.sleep(1.0)
        await scanner.stop()

asyncio.run(main())
