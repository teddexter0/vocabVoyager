// src/components/Friends.jsx — Add friends, see their activity
import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Check, X, Loader, Flame, BookOpen, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Friends = ({ userId, userEmail }) => {
  const [tab, setTab] = useState('friends'); // 'friends' | 'add' | 'requests'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // My username from profile
  const [myUsername, setMyUsername] = useState('');

  useEffect(() => {
    if (userId) {
      fetchFriends();
      fetchRequests();
      fetchMyProfile();
    }
  }, [userId]);

  const fetchMyProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.username) setMyUsername(data.username);
  };

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, friend_id')
        .or(`requester_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendIds = friendships.map(f =>
        f.requester_id === userId ? f.friend_id : f.requester_id
      );

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .in('user_id', friendIds);

      const { data: progress } = await supabase
        .from('user_progress')
        .select('user_id, streak, words_learned, last_visit')
        .in('user_id', friendIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
      const progressMap = {};
      (progress || []).forEach(p => { progressMap[p.user_id] = p; });

      const enriched = friendIds.map(id => ({
        user_id: id,
        displayName: profileMap[id]?.display_name || profileMap[id]?.username || `user_${id.slice(0, 6)}`,
        username: profileMap[id]?.username || '',
        streak: progressMap[id]?.streak || 0,
        words_learned: progressMap[id]?.words_learned || 0,
        last_visit: progressMap[id]?.last_visit || null
      }));

      setFriends(enriched);
    } catch (err) {
      console.error('fetchFriends error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('requester_id, id')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (!data || data.length === 0) { setRequests([]); return; }

      const ids = data.map(r => r.requester_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .in('user_id', ids);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

      setRequests(data.map(r => ({
        id: r.id,
        user_id: r.requester_id,
        displayName: profileMap[r.requester_id]?.display_name
          || profileMap[r.requester_id]?.username
          || `user_${r.requester_id.slice(0, 6)}`
      })));
    } catch (err) {
      console.error('fetchRequests error:', err);
    }
  };

  const searchUser = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError('');

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .eq('username', searchQuery.trim().toLowerCase())
        .maybeSingle();

      if (!data) {
        setSearchError(`No user found with username "${searchQuery.trim()}".`);
        return;
      }
      if (data.user_id === userId) {
        setSearchError("That's you!");
        return;
      }

      // Check if already friends or pending
      const { data: existing } = await supabase
        .from('friendships')
        .select('status')
        .or(
          `and(requester_id.eq.${userId},friend_id.eq.${data.user_id}),and(requester_id.eq.${data.user_id},friend_id.eq.${userId})`
        )
        .maybeSingle();

      setSearchResult({
        ...data,
        displayName: data.display_name || data.username,
        alreadyFriend: existing?.status === 'accepted',
        pending: existing?.status === 'pending'
      });
    } catch (err) {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const sendRequest = async (targetId) => {
    try {
      await supabase.from('friendships').insert({
        requester_id: userId,
        friend_id: targetId,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      setSearchResult(prev => ({ ...prev, pending: true }));
      setActionMsg('Friend request sent!');
    } catch (err) {
      setActionMsg('Failed to send request.');
    }
  };

  const respondRequest = async (friendshipId, accept) => {
    try {
      if (accept) {
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', friendshipId);
      } else {
        await supabase.from('friendships').delete().eq('id', friendshipId);
      }
      setRequests(prev => prev.filter(r => r.id !== friendshipId));
      if (accept) fetchFriends();
    } catch (err) {
      console.error('respondRequest error:', err);
    }
  };

  const daysAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff}d ago`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Users className="w-7 h-7 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Friends</h2>
          <p className="text-gray-500 text-sm">
            Add friends by username — then challenge each other's streaks.
          </p>
        </div>
      </div>

      {myUsername && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          Your username: <span className="font-mono font-semibold text-blue-600">@{myUsername}</span>
          <span className="text-gray-400 ml-2">— share this so friends can find you</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {[
          { id: 'friends', label: `Friends (${friends.length})`, icon: Users },
          { id: 'add', label: 'Add Friend', icon: UserPlus },
          { id: 'requests', label: `Requests${requests.length ? ` (${requests.length})` : ''}`, icon: Check }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
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

      {/* Friends list */}
      {tab === 'friends' && (
        loading ? (
          <div className="flex justify-center py-16"><Loader className="w-6 h-6 animate-spin text-blue-400" /></div>
        ) : friends.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No friends yet — add someone by their username!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map(f => (
              <div key={f.user_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(f.displayName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{f.displayName}</p>
                  {f.username && <p className="text-xs text-gray-400">@{f.username}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <div className="flex items-center gap-1 text-orange-500">
                    <Flame className="w-4 h-4" />
                    <span className="font-bold">{f.streak}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <BookOpen className="w-4 h-4" />
                    <span className="font-bold">{f.words_learned}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    {daysAgo(f.last_visit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add friend */}
      {tab === 'add' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUser()}
              placeholder="Enter exact username…"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={searchUser}
              disabled={searchLoading || !searchQuery.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
            >
              {searchLoading ? <Loader className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {searchError && <p className="text-sm text-red-500">{searchError}</p>}

          {searchResult && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                {(searchResult.displayName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{searchResult.displayName}</p>
                <p className="text-xs text-gray-400">@{searchResult.username}</p>
              </div>
              {searchResult.alreadyFriend ? (
                <span className="text-emerald-600 text-sm font-medium">Already friends ✓</span>
              ) : searchResult.pending ? (
                <span className="text-gray-400 text-sm">Request sent</span>
              ) : (
                <button
                  onClick={() => sendRequest(searchResult.user_id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                >
                  <UserPlus className="w-4 h-4" />
                  Add
                </button>
              )}
            </div>
          )}

          {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}
        </div>
      )}

      {/* Incoming requests */}
      {tab === 'requests' && (
        requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No pending friend requests.</div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(r.displayName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{r.displayName}</p>
                  <p className="text-xs text-gray-400">wants to be your friend</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondRequest(r.id, true)}
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                    title="Accept"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => respondRequest(r.id, false)}
                    className="p-2 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition-colors"
                    title="Decline"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Friends;
