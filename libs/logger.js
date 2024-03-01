// logger.js
import {logger} from 'react-native-logs';

const logMessages = []; // Array to store log messages

const logConfig = {
  severity: 'debug',
  transport: msg => {
    logMessages.push(msg); // Push each log message to the array
    return true;
  },
  transportOptions: {
    colors: 'ansi', // Use 'ansi' for colorful logs in the terminal
  },
  async: true,
};

const log = logger.createLogger(logConfig);

export {log, logMessages};
