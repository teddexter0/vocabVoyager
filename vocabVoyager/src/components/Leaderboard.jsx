// src/components/Leaderboard.jsx — Streak & Words social leaderboard
import React, { useState, useEffect } from 'react';
import { Trophy, Flame, BookOpen, Crown, Loader, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MEDAL = ['🥇', '🥈', '🥉'];

const Leaderboard = ({ userId }) => {
  const [tab, setTab] = useState('global'); // 'global' | 'friends'
  const [globalRows, setGlobalRows] = useState([]);
  const [friendRows, setFriendRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    fetchGlobal();
  }, []);

  useEffect(() => {
    if (tab === 'friends' && userId) fetchFriends();
  }, [tab, userId]);

  const fetchGlobal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, streak, words_learned, total_days')
        .order('streak', { ascending: false })
        .limit(20);

      if (error) { console.warn('Leaderboard query:', error.message); setGlobalRows([]); setLoading(false); return; }

      if (!data) return;

      // Fetch display names from profiles if available
      const rows = await enrichWithProfiles(data);
      setGlobalRows(rows);

      if (userId) {
        const rank = rows.findIndex(r => r.user_id === userId);
        setMyRank(rank >= 0 ? rank + 1 : null);
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    setLoading(true);
    try {
      // Get accepted friend IDs
      const { data: friendships, error: fsErr } = await supabase
        .from('friendships')
        .select('friend_id, requester_id')
        .or(`requester_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (fsErr) { setFriendRows([]); setLoading(false); return; }

      if (!friendships || friendships.length === 0) {
        setFriendRows([]);
        setLoading(false);
        return;
      }

      const friendIds = friendships.map(f =>
        f.requester_id === userId ? f.friend_id : f.requester_id
      );
      friendIds.push(userId); // include self

      const { data } = await supabase
        .from('user_progress')
        .select('user_id, streak, words_learned, total_days')
        .in('user_id', friendIds)
        .order('streak', { ascending: false });

      const rows = await enrichWithProfiles(data || []);
      setFriendRows(rows);
    } catch (err) {
      console.error('Friends leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const enrichWithProfiles = async (rows) => {
    if (!rows.length) return rows;
    try {
      const ids = rows.map(r => r.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .in('user_id', ids);

      if (pErr) return rows.map(r => ({ ...r, displayName: maskEmail(r.user_id) }));

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

      return rows.map(r => ({
        ...r,
        displayName: profileMap[r.user_id]?.display_name
          || profileMap[r.user_id]?.username
          || maskEmail(r.user_id)
      }));
    } catch {
      return rows.map(r => ({ ...r, displayName: maskEmail(r.user_id) }));
    }
  };

  // Fallback: show first 6 chars of user_id
  const maskEmail = (uid) => `user_${(uid || '').slice(0, 6)}`;

  const rows = tab === 'global' ? globalRows : friendRows;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-yellow-100 rounded-xl">
          <Trophy className="w-7 h-7 text-yellow-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Leaderboard</h2>
          <p className="text-gray-500 text-sm">Who's on the longest streak? Who's learned the most?</p>
        </div>
        <button
          onClick={() => { fetchGlobal(); if (tab === 'friends') fetchFriends(); }}
          className="ml-auto p-2 text-gray-400 hover:text-blue-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {[
          { id: 'global', label: 'Global Top 20', icon: Trophy },
          { id: 'friends', label: 'Friends', icon: Users }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 font-medium text-sm border-b-2 transition-colors ${
                tab === t.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-blue-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {tab === 'friends'
            ? 'Add friends to see how you stack up against them!'
            : 'No leaderboard data yet — be the first!'}
        </div>
      ) : (
        <>
          {myRank && tab === 'global' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium text-center">
              Your global rank: #{myRank}
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
            <span className="col-span-1">#</span>
            <span className="col-span-5">Name</span>
            <span className="col-span-3 text-center flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Streak</span>
            <span className="col-span-3 text-center flex items-center justify-center gap-1"><BookOpen className="w-3 h-3 text-green-500" /> Words</span>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => {
              const isMe = r.user_id === userId;
              return (
                <div
                  key={r.user_id}
                  className={`grid grid-cols-12 items-center px-3 py-3 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-blue-50 border-blue-300 font-semibold'
                      : i < 3
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className="col-span-1 text-lg">
                    {i < 3 ? MEDAL[i] : <span className="text-sm text-gray-400">{i + 1}</span>}
                  </span>
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    {i === 0 && <Crown className="w-4 h-4 text-yellow-500 shrink-0" />}
                    <span className="truncate text-sm text-gray-800">
                      {r.displayName}
                      {isMe && <span className="text-blue-500 ml-1 text-xs">(you)</span>}
                    </span>
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="text-orange-500 font-bold">{r.streak || 0}</span>
                    <span className="text-xs text-gray-400 ml-0.5">d</span>
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="text-green-600 font-bold">{r.words_learned || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
