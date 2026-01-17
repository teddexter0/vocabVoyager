import React from 'react';

const ContactUs = () => {
  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact VocabVoyager Support</h2>
      <p className="text-gray-600 mb-6">
        Having trouble with your AI Quiz or Premium status? We're here to help.
      </p>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="font-semibold text-blue-800">Email Us At</p>
          <a href="mailto:teddexter0@gmail.com" className="text-blue-600">support@vocabvoyager.com</a>
        </div>
        <div className="text-sm text-gray-500 italic">
          Tip: If reporting a technical bug, please include your User ID found in the settings.
        </div>
      </div>
    </div>
  );
};

export default ContactUs;