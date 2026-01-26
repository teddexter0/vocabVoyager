import React from 'react';

import PrivacyPolicy from './PrivacyPolicy';
import ContactUs from './ContactUs';
import ReviewDashboard from '../ReviewDashboard';
import Pricing from '../Pricing';   
const TermsOfService = () => (
  <div className="max-w-3xl mx-auto p-8 bg-white mt-10 rounded-2xl shadow-sm border border-gray-100">
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
 <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
    <div className="text-gray-600 space-y-4">
      <section>
        <h2 className="text-lg font-bold text-gray-800">1. Subscriptions</h2>
        <p>Premium access is billed at KES 499 for 30 days. Payments are handled via Pesapal and are non-refundable once the AI Assistant is used.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-gray-800">2. AI Usage</h2>
        <p>AI insights are powered by Anthropic. Users agree not to use the assistant for generating prohibited content.</p>
      </section>
      <section>
        <h2 className="text-lg font-bold text-gray-800">3. Data</h2>
        <p>Your learning progress is saved to your account. We are not responsible for data loss due to account sharing.</p>
      </section>
    </div>
  </div>
);

export default TermsOfService;