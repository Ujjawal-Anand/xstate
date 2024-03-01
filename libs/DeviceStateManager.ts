import { deviceState } from '../reducer';
import { store } from 'store';
import axios from 'axios/index';
import { getAgeOfLastVideoHeartbeat } from '../reducer/selectors';
import { DeviceEventEmitter, Platform } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';
import { LaunchArguments } from 'react-native-launch-arguments';
import { TestLaunchArguments } from 'e2e/types';
import { trim } from 'lodash-es';
import {
    SerialCommandName,
    DeviceStatus,
    networkAPICommand,
    SerialResponseName,
    serialDecode,
    serialTransmit,
} from './lib';
import { actions, RNSerialport } from 'react-native-serialport';

const launchArgs = LaunchArguments.value<TestLaunchArguments>();

// let RNSerialportInit;
//
// if (Platform.OS === 'android') {
//     RNSerialportInit = require('react-native-serialport');
// }
// const RNSerialport = RNSerialportInit;
// const { actions } = RNSerialportModule;

export class DeviceStateManager {
    serialStatus: DeviceStatus | null = null;
    constructor() {
        if (Platform.OS === 'android') {
            RNSerialport.setReturnedDataType(2);
            RNSerialport.setAutoConnect(false);
            RNSerialport.setAutoConnectBaudRate(115200);
            RNSerialport.setDriver('cdc');
            RNSerialport.setReturnedDataType(1); // 1 = Int Array, 2 = Hex String
            // RNSerialport.setInterface(1);
            RNSerialport.startUsbService();

            DeviceEventEmitter.addListener(actions.ON_CONNECTED, () => {
                console.log('RN serial connected');
            });

            DeviceEventEmitter.addListener(actions.ON_DEVICE_ATTACHED, () => {
                console.log('RN serial device attached');
            });

            DeviceEventEmitter.addListener(actions.ON_READ_DATA, this.readSerialData);

            DeviceEventEmitter.addListener(actions.ON_ERROR, (error) => {
                console.log('RN serial error:', error);
            });
        }
        console.log('Starting therapy watchdog');
        if (launchArgs?.disableDevicePresenceCheck) {
            console.log('Device presence check disabled');
        } else {
            setInterval(this.start, 5000);
        }
        // this.isLastTherapyHeartbeatValid = this.isLastTherapyHeartbeatValid.bind(this);
    }

    readSerialData = (data) => {
        // console.log('RN serial read raw:', data);
        // console.log('RN serial read:', RNSerialport.intArrayToUtf16(data.payload));
        //base64 decode the payload
        // const decoded = Buffer.from(data.payload, 'base64').toString('utf-8');
        try {
            const rawPayload = RNSerialport.intArrayToUtf16(data.payload);
            const decodedPayload = serialDecode(rawPayload);
            if (decodedPayload.command === SerialResponseName.SERIAL_RESPONSE_STATUS) {
                const trimmedJson = trim(decodedPayload.payload.trim(), '\n');
                console.log('trimmedJson', trimmedJson);
                const deviceStatusResponse: DeviceStatus = JSON.parse(decodedPayload.payload);
                store.dispatch(deviceState.actions.updateDeviceStatus(deviceStatusResponse));
                store.dispatch(deviceState.actions.updateDevicePresent(true));
                this.serialStatus = deviceStatusResponse;
                console.log('deviceStatusResponse', deviceStatusResponse);
                console.log('decodedPayload', decodedPayload);
            }
            console.log('RN serial read:', decodedPayload);

            // console.log('raw:', data.payload);
            // const deviceStatusResponse: deviceStatus = JSON.parse(decodedPayload);
            // console.log('RN Serial Device Status:', deviceStatusResponse.current_state);
            // store.dispatch(deviceState.actions.updateDeviceStatus(deviceStatusResponse));
            // store.dispatch(deviceState.actions.updateDevicePresent(true));
        } catch (e) {
            console.log('Roga serial read error:', e);
            store.dispatch(deviceState.actions.clearDeviceStatus());
        }
    };

    start = async () => {
        let deviceStatusResponse: DeviceStatus | null = null;
        //device status polling
        try {
            if (Platform.OS === 'android') {
                await serialTransmit(SerialCommandName.SERIAL_RETURN_STATUS);
                deviceStatusResponse = this.serialStatus;
                // const serialPort = await SerialPortAPI.open('/dev/ttyACM0', { baudRate: 115200 });
                // await serialPort.send('00FF');
                // const sub = serialPort.onReceived((buff) => {
                //     console.log(buff.toString('hex').toUpperCase());
                // });
                //USB based presence detection
                // const androidDevicePresence = await RogaDevicePresence.checkForDevice();
                // store.dispatch(deviceState.actions.updateDevicePresent(androidDevicePresence));
                // console.log('androidDevicePresence:', androidDevicePresence);
            }

            if (Platform.OS === 'ios') {
                //Because Android doesn't have network based connectivity at this time
                const deviceAPIResponse = await axios.get<DeviceStatus>('http://192.168.7.1/status.json', {
                    timeout: 1000,
                    timeoutErrorMessage: 'Device API timeout',
                });
                deviceStatusResponse = deviceAPIResponse.data;

                store.dispatch(deviceState.actions.updateDeviceStatus(deviceStatusResponse));
                store.dispatch(deviceState.actions.updateDevicePresent(true));
                // console.log(deviceStatusResponse);
            }
        } catch (e) {
            store.dispatch(deviceState.actions.clearDeviceStatus());
            crashlytics().log('Exception when checking Roga device presence');
            crashlytics().recordError(e);
        }

        const isVideoHeartbeatValid =
            getAgeOfLastVideoHeartbeat(store.getState()) !== null && getAgeOfLastVideoHeartbeat(store.getState()) <= 5;
        const isDeviceInTherapyMode = deviceStatusResponse?.current_state === 'THERAPY';

        //device command loop
        console.log(
            'isVideoHeartbeatValid',
            isVideoHeartbeatValid,
            'isDeviceInTherapyMode',
            isDeviceInTherapyMode,
            'getAgeOfLastVideoHeartbeat',
            getAgeOfLastVideoHeartbeat(store.getState()),
            'deviceStatusResponse',
            deviceStatusResponse?.current_state,
        );

        //Because Android doesn't have device connectivity at this time
        if (isVideoHeartbeatValid && !isDeviceInTherapyMode) {
            if (Platform.OS === 'ios') {
                await networkAPICommand('skip');
            }
            if (Platform.OS === 'android') {
                await serialTransmit(SerialCommandName.SERIAL_SKIP);
            }
            console.log('Starting therapy');
        } else if (isVideoHeartbeatValid && isDeviceInTherapyMode) {
            console.log('Device is in therapy mode');
        } else if (!isVideoHeartbeatValid && isDeviceInTherapyMode) {
            if (Platform.OS === 'ios') {
                await networkAPICommand('stop_therapy');
            }
            if (Platform.OS === 'android') {
                await serialTransmit(SerialCommandName.SERIAL_STOP);
            }
            console.log('Stopping therapy');
        }
        console.log('command loop done');
    };
}
