// src/components/ReviewDashboard.jsx
import React, { useState, useEffect } from 'react';
import { spacedRepetitionService } from '../lib/spacedRepetition';

const ReviewDashboard = ({ userId }) => {
  // 1. Create local state for the data
  const [reviewWords, setReviewWords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!userId) return;
      try {
        setLoading(true);
        // 2. Call the object methods directly (no more "spacedRepetitionService()")
        const words = await spacedRepetitionService.getReviewWords(userId);
        const userStats = await spacedRepetitionService.getLearningStats(userId);
        
        setReviewWords(words || []);
        setStats(userStats);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [userId]);

  if (loading) return <div className="p-6">Loading stats...</div>;

  return ( 
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">📊 Learning Progress</h2>
      
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Words Mastered</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.mastered}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Overall Accuracy</h3>
            <p className="text-2xl font-bold text-green-600">
              {Math.round(stats.averageAccuracy * 100)}%
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-orange-800">Due for Review</h3>
            <p className="text-2xl font-bold text-orange-600">{stats.wordsForReview}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800">Total Words</h3>
            <p className="text-2xl font-bold text-purple-600">{stats.totalWords}</p>
          </div>
        </div>
      )}
      
      {reviewWords.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">📝 Words Due for Review Today</h3>
          <div className="grid gap-2">
            {reviewWords.slice(0, 5).map((word) => (
              <div key={word.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="font-medium">{word.words.word}</span>
                <span className="text-sm text-gray-600">{word.confidence_level}</span>
              </div>
            ))}
          </div>
          {reviewWords.length > 5 && (
            <p className="text-sm text-gray-500 mt-2">
              +{reviewWords.length - 5} more words due for review
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewDashboard;