import axios from 'axios';
import {find} from 'lodash';
import RNSerialportModule, {
  ActionsStatic,
  DefinitionsStatic,
  RNSerialportStatic,
} from 'react-native-serialport';

// let     RNSerialportInit = require('react-native-serialport');

// if (Platform.OS === 'android') {
//     RNSerialportInit = require('react-native-serialport');
// }

export interface IRNSerialport {
  RNSerialport: RNSerialportStatic;
  definitions: DefinitionsStatic;
  actions: ActionsStatic;
}
// export const RNSerialportModule: IRNSerialport = RNSerialportInit;
export enum SerialCommandName {
  SERIAL_RETURN_STATUS = 'CMDSTATUSX',
  SERIAL_START = 'CMDSTARTXX',
  SERIAL_STOP = 'CMDSTOPXXX',
  SERIAL_STALL = 'CMDSTALLXX',
  SERIAL_SKIP = 'CMDSKIPXXX',
  SERIAL_RESET = 'CMDRESETXX',
  SERIAL_CHANGE_DURATION = 'CMDCHGENDX',
  SERIAL_DUMP_CONF = 'CMDCNFDUMP',
  SERIAL_TEST_NEW_CONF = 'CMDCNFTEST',
  SERIAL_SAVE_NEW_CONF = 'CMDCNFSAVE',
  SERIAL_FLASH = 'CMDFLASHXX',
}

export enum SerialResponseName {
  SERIAL_RESPONSE_STATUS = 'RESSTATUSX',
  SERIAL_RESPONSE_CONFIGDUMP = 'RESCNFDUMP',
  SERIAL_RESPONSE_CMD_ERROR = 'RESCMDERRX',
}

export type DeviceModeName =
  | 'INIT'
  | 'IDLE'
  | 'PRECHECK'
  | 'HELLO'
  | 'THERAPY'
  | 'END';

export interface DeviceStatus {
  current_time: number;
  current_state: DeviceModeName;
  therapy_state: {
    current_step: number;
    start_at: number;
    end_at: number;
  };
  electrode_state: {
    electrodes_connected: boolean;
    high_val: number;
    low_val: number;
    minimum: number;
  };
  device_info: {
    serial_number: string;
    firmware_version: string;
  };
}

export type EthernetCommandName = 'start_therapy' | 'stop_therapy' | 'skip';
export enum EthernetCommandNameEnum {
  START_THERAPY = 'start_therapy',
  STOP_THERAPY = 'stop_therapy',
  SKIP = 'skip',
  FLASH = 'flash',
  STALL = 'stall',
  CHANGE_THERAPY_DURATION = 'change_therapy_duration',
}
export const networkAPICommand = async (command: EthernetCommandNameEnum) => {
  try {
    const response = await axios.get(`http://192.168.7.1/${command}`, {
      timeout: 1000,
      timeoutErrorMessage: 'Device API Timeout',
    });
    console.log('response', response);
  } catch (e) {
    console.log('error', e);
  }
};
export const serialTransmit = async (
  command: SerialCommandName,
  payload: string | null = null,
) => {
  try {
    let isSerialDeviceConnected =
      await RNSerialportModule.RNSerialport.isOpen();

    if (!isSerialDeviceConnected) {
      const deviceList = await RNSerialportModule.RNSerialport.getDeviceList();
      if (deviceList) {
        console.log(deviceList);
        RNSerialportModule.RNSerialport.connectDevice(
          deviceList[0].name,
          115200,
        );
        isSerialDeviceConnected =
          await RNSerialportModule.RNSerialport.isOpen();
      }
    }

    console.log('writable', command);
    if (isSerialDeviceConnected) {
      RNSerialportModule.RNSerialport.writeString(`${command}\r`);
    }
  } catch (error) {
    console.log('Error ', error.message);
  }
};
export const serialDecode = (response: string) => {
  const rawCommand = response.substring(0, 10);
  const command = find(SerialResponseName, value => value === rawCommand);

  let payload: null | string = null;
  if (response.length > 11) {
    payload = response.substring(11, response.length);
  }

  return {command, payload};
};
