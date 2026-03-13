import React from 'react';

const ContactUs = ({ userId }) => {
  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-100 mt-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact VocabVoyager Support</h2>
      <p className="text-gray-600 mb-6">
        Having trouble with your AI Quiz or Premium status? We're here to help.
      </p>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="font-semibold text-blue-800">Email Us At</p>
          <a href="mailto:support@vocabvoyager.com" className="text-blue-600">support@vocabvoyager.com</a>
        </div>

        {userId && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-1">Your User ID</p>
            <code className="text-xs text-gray-600 break-all bg-white px-2 py-1 rounded border border-gray-200 block">
              {userId}
            </code>
            <p className="text-xs text-gray-400 mt-1">Include this when reporting a bug so we can find your account quickly.</p>
          </div>
        )}

        {!userId && (
          <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
            Tip: Sign in first, then return here — we'll show your User ID so support can locate your account quickly.
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactUs;
