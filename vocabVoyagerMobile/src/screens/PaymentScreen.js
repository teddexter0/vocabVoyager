// src/screens/PaymentScreen.js
import React, { useState } from 'react';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';

export default function PaymentScreen({ route, navigation }) {
  const [loading, setLoading] = useState(false);

  const handlePesapalPayment = async () => {
    try {
      setLoading(true);
      
      // Initiate payment with Pesapal
      const paymentResult = await pesapalService.initiatePayment(user.email, 'premium');
      
      if (paymentResult.success) {
        // Open payment URL in browser
        const result = await WebBrowser.openBrowserAsync(paymentResult.redirectUrl);
        
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // User cancelled payment
          Alert.alert('Payment Cancelled', 'Payment was not completed.');
        }
      }
    } catch (error) {
      Alert.alert('Payment Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Payment screen implementation
}