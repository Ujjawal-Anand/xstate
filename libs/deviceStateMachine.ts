/* eslint-disable @typescript-eslint/member-delimiter-style */
/* eslint-disable @typescript-eslint/semi */
/* eslint-disable @typescript-eslint/indent */
import {createMachine, assign} from 'xstate';
import {
  type DeviceStatus,
  serialTransmit,
  networkAPICommand,
  SerialCommandName,
} from './lib';
// import {Platform} from 'react-native';
import axios from 'axios';
import {log} from './logger';

interface DeviceContext {
  deviceStatus: DeviceStatus | null;
  retries: number;
}

type DeviceEvent =
  | {type: 'CONNECT'; data: null}
  | {type: 'DISCONNECT'}
  | {type: 'STATUS_RECEIVED'; data: DeviceStatus}
  | {type: 'ERROR'; error: Error};

interface PlatformActions {
  connect: () => void | Promise<void>;
  poll: (context: any, event: any) => void;
}

interface PlatformSpecificActions {
  android: PlatformActions;
  ios: PlatformActions;
}

const platformSpecificActions: PlatformSpecificActions = {
  android: {
    connect: async (): Promise<void> => {
      // Android-specific connection logic
      log.debug('xstate: came here');

      try {
        // if (Platform.OS === 'android') {
        await serialTransmit(SerialCommandName.SERIAL_RETURN_STATUS);

        // }
      } catch (error) {
        Promise.reject(new Error(`HTTP error ${error.message}`));
      }
    },
    poll: (context: any, event: any): void => {
      // Android-specific polling logic
    },
  },
  ios: {
    connect: (): void => {
      // Assuming Platform and axios are imported from their respective libraries
      if (Platform.OS === 'ios') {
        axios
          .get<DeviceStatus>('http://192.168.7.1/status.json', {
            timeout: 1000,
            timeoutErrorMessage: 'Device API timeout',
          })
          .then(async response => {
            if (response.status !== 200) {
              return await Promise.reject(
                new Error(
                  `HTTP error ${response.status}: ${response.statusText}`,
                ),
              );
            }
            return response.data;
          })
          .catch(async error => {
            return await Promise.reject(
              new Error(`HTTP error ${error.message}`),
            );
          });
      }
    },
    poll: (context: any, event: any): void => {
      // iOS-specific polling logic
    },
  },
};

type DeviceState =
  | {
      value: 'disconnected';
      context: {
        deviceStatus: null;
        retries: number;
      };
    }
  | {
      value: 'connecting';
      context: {
        deviceStatus: null;
        retries: number;
      };
    }
  | {
      value: 'reConnecting';
      context: {
        deviceStatus: null;
        retries: number;
      };
    }
  | {
      value: 'connected';
      context: {
        deviceStatus: DeviceStatus;
        retries: number;
      };
    };

const deviceStateMachine = createMachine<
  DeviceContext,
  DeviceEvent,
  DeviceState
>(
  {
    id: 'device',
    initial: 'disconnected',
    context: {
      deviceStatus: null,
      retries: 0,
    },
    states: {
      disconnected: {
        on: {
          CONNECT: {
            target: 'connecting',
          },
        },
      },
      connecting: {
        entry: ['onConnect', 'incrementRetries'],
        on: {},
        after: {
          1000: [
            // {target: 'reConnecting', cond: 'canRetry'},
            {target: 'disconnected'},
          ],
        },
      },
      reConnecting: {
        entry: ['reconnecting'],
        always: {target: 'connecting'},
      },
      connected: {
        entry: [
          [
            {target: '.INIT', cond: 'isInit'},
            {target: '.IDLE', cond: 'isIdle'},
            {target: '.PRECHECK', cond: 'isPrecheck'},
            {target: '.HELLO', cond: 'isHello'},
            {target: '.THERAPY', cond: 'isTherapy'},
            {target: '.END', cond: 'isEnd'},
          ],
        ],
        on: {
          DISCONNECT: 'disconnected',
        },
        initial: 'INIT',
        states: {
          INIT: {
            on: {},
          },
          IDLE: {},
          PRECHECK: {},
          HELLO: {},
          THERAPY: {},
          END: {},
        },
      },
    },
    on: {
      ERROR: {
        target: '.disconnected',
      },
      STATUS_RECEIVED: {
        actions: assign((ctx, event) => {
          log.debug('XState Status received', event?.data);
          return {
            ...ctx,
            deviceStatus: event?.data,
          };
        }),
        target: '.connected',
      },
    },
  },
  {
    actions: {
      onConnect: platformSpecificActions[Platform.OS].connect,
      reconnecting: (context, event) => {
        console.log(`Attempt ${context.retries}: Trying action...`);
      },
      incrementRetries: assign({
        retries: context => context.retries + 1,
      }),
    },
    guards: {
      canRetry: context => context.retries < 3, // Allow retry if less than 3
      isInit: (context, event) => context.deviceStatus.current_state === 'INIT',
      isIdle: (context, event) => context.deviceStatus.current_state === 'IDLE',
      isPrecheck: (context, event) =>
        context.deviceStatus.current_state === 'PRECHECK',
      isHello: (context, event) =>
        context.deviceStatus.current_state === 'HELLO',
      isTherapy: (context, event) =>
        context.deviceStatus.current_state === 'THERAPY',
      isEnd: (context, event) => context.deviceStatus.current_state === 'END',
    },
  },
);

export default deviceStateMachine;
