// src/components/Pricing.jsx
import React from 'react';
import { CheckCircle, Crown } from 'lucide-react';

import PrivacyPolicy from './legal/PrivacyPolicy';
import ContactUs from './legal/ContactUs';
import ReviewDashboard from './ReviewDashboard'; 
import TermsOfService from './legal/TermsOfService';
const Pricing = ({ onUpgrade }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
              {/* Header */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
  <div>
    <h1
      className="text-3xl font-bold text-gray-800 cursor-pointer"
      onClick={() => setCurrentView('dashboard')}
    >
      📚 VocabVoyager
    </h1>
    <p className="text-gray-600">Smart vocabulary learning platform</p>
  </div>

</div>
 
<div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Choose the plan that fits your learning journey
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                KES 0
              </div>
              <p className="text-gray-600">Forever free</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">3 new words daily</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Level 1 vocabulary (100+ words)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Basic spaced repetition</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Progress tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Daily streak rewards</span>
              </li>
            </ul>

            <button className="w-full py-3 px-6 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
              Current Plan
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-2xl p-8 border-2 border-yellow-300 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>

            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-white" />
                <h3 className="text-2xl font-bold text-white">Premium</h3>
              </div>
              <div className="text-5xl font-bold text-white mb-2">
                KES 499
              </div>
              <p className="text-white/90">per month</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">Everything in Free, plus:</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white">All 5 difficulty levels (450+ words)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white">AI Learning Assistant with personalized insights</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white">Advanced spaced repetition algorithm</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white">Detailed learning analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
                <span className="text-white">Priority support</span>
              </li>
            </ul>

            <button
              onClick={onUpgrade}
              className="w-full py-4 px-6 bg-white text-orange-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Upgrade to Premium
            </button>

            <p className="text-center text-white/80 text-sm mt-4">
              Secure payment via Pesapal
            </p>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Payment Information
            </h3>
            <div className="space-y-3 text-gray-700">
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Secure Payments:</strong> All transactions processed by Pesapal, Kenya's trusted payment gateway</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Payment Methods:</strong> M-Pesa, Credit/Debit Cards, Airtel Money</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Billing:</strong> Monthly subscription, automatically renews</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Cancellation:</strong> Cancel anytime from your account settings</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>Refunds:</strong> Full refund within 7 days if premium features not used</span>
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h4 className="font-bold text-gray-900 mb-2">How does billing work?</h4>
              <p className="text-gray-700">You'll be charged KES 499 per month. Payment is processed securely through Pesapal. Your subscription automatically renews monthly.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h4 className="font-bold text-gray-900 mb-2">Can I cancel anytime?</h4>
              <p className="text-gray-700">Yes! You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h4 className="font-bold text-gray-900 mb-2">What payment methods do you accept?</h4>
              <p className="text-gray-700">We accept M-Pesa, Visa/Mastercard credit/debit cards, and Airtel Money through our payment partner Pesapal.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h4 className="font-bold text-gray-900 mb-2">Is there a refund policy?</h4>
              <p className="text-gray-700">Yes. If you haven't used any premium features, you can request a full refund within 7 days of purchase. Contact support@vocabvoyager.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    
  );
};

export default Pricing;