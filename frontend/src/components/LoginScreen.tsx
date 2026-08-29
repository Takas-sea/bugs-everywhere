import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowLeft,
} from 'lucide-react';

import tabiMemoryIcon from '../../assets/tabi-memory-icon.png';

interface LoginScreenProps {
  onLogin: (email: string) => void;
}

type Mode = 'login' | 'forgot-password' | 'change-email';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!email.trim() || !password.trim()) {
      setMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    if (!email.includes('@')) {
      setMessage('正しいメールアドレスを入力してください。');
      return;
    }

    if (password.length < 6) {
      setMessage('パスワードは6文字以上で入力してください。');
      return;
    }

    localStorage.setItem('tabi-memory-email', email.trim());
    onLogin(email.trim());
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!email.trim() || !email.includes('@')) {
      setMessage('登録したメールアドレスを入力してください。');
      return;
    }

    setMessage(
      'パスワード再設定用メールを送信した想定です（現在はデモ画面です）。'
    );
  };

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!newEmail.trim() || !newEmail.includes('@')) {
      setMessage('新しいメールアドレスを入力してください。');
      return;
    }

    setEmail(newEmail.trim());
    localStorage.setItem('tabi-memory-email', newEmail.trim());
    setMessage('メールアドレスを変更しました。');
    setNewEmail('');
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10"
      style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
    >
      <div className="w-full max-w-md">

        {/* ロゴ部分 */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={tabiMemoryIcon}
            alt="TABI MEMORY"
            className="w-20 h-20 rounded-[22px] object-cover shadow-xl mb-4"
          />

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
            MemoriTrip
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            みんなの写真から旅日記へ
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">

          {mode !== 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage('');
              }}
              className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950 mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              ログインに戻る
            </button>
          )}

          {mode === 'login' && (
            <>
              <h2 className="text-2xl font-bold text-slate-950">
                ログイン
              </h2>

              <p className="mt-2 text-sm text-slate-500">
              </p>

              <form onSubmit={handleLogin} className="mt-7 space-y-5">

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    メールアドレス
                  </label>

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    パスワード
                  </label>

                  <div className="relative">
                    <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6文字以上"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-12 pr-12 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label="パスワード表示切り替え"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {message && (
                  <p className="text-sm text-rose-600">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-[#003B95] text-white font-bold hover:bg-[#002F75] transition-colors"
                >
                  ログイン
                </button>
              </form>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">

                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot-password');
                    setMessage('');
                  }}
                  className="font-bold text-[#003B95] hover:underline"
                >
                  パスワードを変更
                </button>

                <span className="hidden sm:inline text-slate-300">
                  |
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setMode('change-email');
                    setMessage('');
                  }}
                  className="font-bold text-[#003B95] hover:underline"
                >
                  メールアドレスを変更
                </button>
              </div>
            </>
          )}

          {mode === 'forgot-password' && (
            <>
              <h2 className="text-2xl font-bold text-slate-950">
                パスワードを再設定
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                登録したメールアドレスを入力してください。
              </p>

              <form onSubmit={handlePasswordReset} className="mt-7 space-y-5">

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    メールアドレス
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                {message && (
                  <p className="text-sm text-slate-600">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-[#003B95] text-white font-bold hover:bg-[#002F75]"
                >
                  再設定メールを送る
                </button>
              </form>
            </>
          )}

          {mode === 'change-email' && (
            <>
              <h2 className="text-2xl font-bold text-slate-950">
                メールアドレスを変更
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                新しいメールアドレスを入力してください。
              </p>

              <form onSubmit={handleEmailChange} className="mt-7 space-y-5">

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    新しいメールアドレス
                  </label>

                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new-email@example.com"
                    className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                {message && (
                  <p className="text-sm text-slate-600">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-[#003B95] text-white font-bold hover:bg-[#002F75]"
                >
                  メールアドレスを変更
                </button>
              </form>
            </>
          )}

        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
        </p>

      </div>
    </div>
  );
};