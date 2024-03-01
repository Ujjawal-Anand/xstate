/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  useColorScheme,
  View,
  Button,
  Text,
  StyleSheet,
} from 'react-native';

import useDeviceStateManager from './libs/useDeviceStateManager';

import {Colors, Header} from 'react-native/Libraries/NewAppScreen';
import {logMessages} from './libs/logger';

const App: () => Node = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const {start, state} = useDeviceStateManager();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const styles = StyleSheet.create({
    container: {
      padding: 10,
    },
    logText: {
      fontFamily: 'monospace', // Use monospace font for better readability
      fontSize: 12,
      marginBottom: 5,
    },
  });

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          <Button
            title="Start"
            onPress={start}
            color="#841584" // Optional: Button color
          />
          <Text selectable={true}> State: {JSON.stringify(state)}</Text>
          <Text> Logs: </Text>
          {Array.isArray(logMessages) &&
            logMessages.map((msg, index) => (
              <Text key={index} style={styles.logText} selectable={true}>
                {msg.msg}
              </Text>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
