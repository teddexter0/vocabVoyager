import React from 'react';

const PrivacyPolicy = () => (
  <div className="max-w-3xl mx-auto p-8 bg-white mt-10 rounded-2xl shadow-sm border border-gray-100">
    <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
    <div className="text-gray-600 space-y-4">
      <p>VocabVoyager uses <strong>Supabase Auth</strong> to manage your account. We collect your email address strictly for authentication and to sync your learning progress.</p>
      <p>Your learning statistics and streak data are stored to provide personalized insights via <strong>Anthropic Claude</strong>. No payment details are stored on our servers; all transactions are handled securely by <strong>Pesapal</strong>.</p>
    </div>
  </div>
);

export default PrivacyPolicy;