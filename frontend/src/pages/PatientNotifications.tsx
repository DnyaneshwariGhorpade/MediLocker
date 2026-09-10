import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, ShieldAlert, FileText, CalendarClock } from 'lucide-react';

const PatientNotifications = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setNotifications(await res.json());
    } catch (e) { console.error(e); }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.notification_id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (e) { console.error(e); }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.read_at;
    if (filter === 'ALERTS') return n.event_type === 'EMERGENCY_ACCESS' || n.event_type === 'FLAGGED_REPORT';
    return true;
  });

  const getIcon = (type: string) => {
    switch(type) {
      case 'EMERGENCY_ACCESS': return <ShieldAlert className="w-6 h-6 text-red-600" />;
      case 'FLAGGED_REPORT': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'NEW_RECORD_UPLOAD': return <FileText className="w-6 h-6 text-blue-500" />;
      case 'ACCESS_REQUEST': return <ShieldAlert className="w-6 h-6 text-indigo-500" />;
      case 'FOLLOW_UP_REMINDER': return <CalendarClock className="w-6 h-6 text-emerald-500" />;
      default: return <Bell className="w-6 h-6 text-slate-500" />;
    }
  };

  const getBgColor = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-white border-slate-200';
    switch(type) {
      case 'EMERGENCY_ACCESS': return 'bg-red-50 border-red-200';
      case 'FLAGGED_REPORT': return 'bg-amber-50 border-amber-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Bell className="w-8 h-8 text-slate-700" />
              Real-Time Notifications
            </h1>
            <p className="text-slate-500 mt-2">Alerts for record uploads, access requests, and security events.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={markAllAsRead} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {['ALL', 'UNREAD', 'ALERTS'].map(f => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${filter === f ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-4">
          {filtered.map(notification => (
            <div 
              key={notification.notification_id} 
              className={`p-6 rounded-3xl border shadow-sm flex items-start gap-5 transition-all ${getBgColor(notification.event_type, !!notification.read_at)}`}
            >
              <div className="shrink-0 mt-1">
                {getIcon(notification.event_type)}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-bold text-lg ${notification.read_at ? 'text-slate-700' : 'text-slate-900'}`}>{notification.title}</h3>
                  <span className="text-xs font-semibold text-slate-400 shrink-0 ml-4">{new Date(notification.created_at).toLocaleString()}</span>
                </div>
                <p className={`mb-4 ${notification.read_at ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>{notification.message}</p>
                
                {/* Actions based on type */}
                <div className="flex items-center gap-3">
                  {!notification.read_at && (
                    <button onClick={() => markAsRead(notification.notification_id)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                      <Check className="w-3 h-3" /> Mark Read
                    </button>
                  )}
                  {notification.event_type === 'ACCESS_REQUEST' && (
                    <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200">
                      Review Request
                    </button>
                  )}
                  {notification.event_type === 'EMERGENCY_ACCESS' && (
                    <button className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100/50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200">
                      View Audit Log
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-100 shadow-sm">
              You're all caught up!
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PatientNotifications;
