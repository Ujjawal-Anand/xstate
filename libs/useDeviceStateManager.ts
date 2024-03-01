import {useEffect, useState} from 'react';
import {DeviceEventEmitter, Platform} from 'react-native';
import {RNSerialport, actions} from 'react-native-serialport';
import {trim} from 'lodash-es';
import {
  serialDecode,
  SerialCommandName,
  SerialResponseName,
  serialTransmit,
  DeviceStatus,
} from './lib'; // Adjust imports as necessary
import {useMachine} from '@xstate/react';
import deviceStateMachine from './deviceStateMachine';
import {log} from './logger';
const useDeviceStateManager = () => {
  const [serialStatus, setSerialStatus] = useState(null);
  const [state, send] = useMachine(deviceStateMachine);

  // Function equivalent to readSerialData method
  const readSerialData = data => {
    try {
      const rawPayload = RNSerialport.intArrayToUtf16(data.payload);
      const decodedPayload = serialDecode(rawPayload);
      if (
        decodedPayload.command === SerialResponseName.SERIAL_RESPONSE_STATUS
      ) {
        const trimmedJson = trim(decodedPayload.payload.trim(), '\n');
        log.info(`trimmed ${trimmedJson}`);
        log.info(`payload ${decodedPayload}`);
        const deviceStatusResponse = JSON.parse(trimmedJson) as DeviceStatus;
        send({
          type: 'STATUS_RECEIVED',
          data: deviceStatusResponse,
        });

        setSerialStatus(deviceStatusResponse);
      }
    } catch (e) {
      log.error('Serial read error:' + e.message + '\n');

      //   store.dispatch(deviceState.actions.clearDeviceStatus());
    }
  };

  // Function equivalent to start method
  const start = () => {
    send({type: 'CONNECT', data: null});
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      // Android-specific setup, similar to the constructor logic
      RNSerialport?.startUsbService();
      DeviceEventEmitter.addListener(actions.ON_CONNECTED, () =>
        log.info('RN serial connected'),
      );
      DeviceEventEmitter.addListener(actions.ON_DEVICE_ATTACHED, () =>
        log.info('RN serial device attached' + '\n'),
      );
      DeviceEventEmitter.addListener(actions.ON_READ_DATA, readSerialData);
      DeviceEventEmitter.addListener(actions.ON_ERROR, error =>
        log.error('RN serial error: ' + error + '\n'),
      );
    }

    log.info('Starting therapy watchdog' + '\n');
    // The rest of your setup logic here

    // Cleanup function for useEffect
    return () => {
      // Remove all listeners to avoid memory leaks
      DeviceEventEmitter.removeAllListeners();
    };
  }, []);

  return {
    start,
    state,
  };
};

export default useDeviceStateManager;
