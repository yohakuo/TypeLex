'use client';

import { FormEvent, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function SettingsPage() {
  const { sync, syncControls, data } = useAppData();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await syncControls.sendMagicLink(email);

    if (!result.ok) {
      setMessage(result.error ?? '发送登录链接失败。');
      return;
    }

    setMessage('登录链接已发送，请去邮箱确认。');
  }

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <p className="kicker">本地优先 + 可选云同步</p>
            <h1>同步设置</h1>
            <p>默认仍保存在当前浏览器。登录后可把整份学习数据同步到你自己的 Supabase 账号。</p>
          </div>
        </section>

        <section className="grid grid-2">
          <article className="panel stat-panel">
            <div className="stat-value">{data.books.length}</div>
            <h2>本机单词本</h2>
            <p>当前设备上的本地学习数据始终可离线使用。</p>
          </article>
          <article className="panel stat-panel">
            <div className="stat-value">{sync.statusLabel}</div>
            <h2>同步状态</h2>
            <p>
              {sync.email ? `当前账号：${sync.email}` : '尚未登录同步账号。'}
              {sync.metadata.lastSyncedAt ? ` 上次同步：${formatDateTime(sync.metadata.lastSyncedAt)}。` : ''}
            </p>
          </article>
        </section>

        {!sync.available ? (
          <section className="panel">
            <h2>未启用 Supabase</h2>
            <p className="help-text">当前未配置 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY，应用会继续保持纯本地模式。</p>
          </section>
        ) : null}

        {sync.available && !sync.session ? (
          <section className="panel">
            <h2>邮箱魔法链接登录</h2>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                邮箱地址
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <div className="button-row">
                <button type="submit" className="button" disabled={sync.isBusy}>
                  发送登录链接
                </button>
              </div>
            </form>
            {message ? <p className="notice notice-success">{message}</p> : null}
          </section>
        ) : null}

        {sync.available && sync.session ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>同步控制</h2>
                  <p className="section-subtitle">本地仍然先可用；只有点击按钮时才会与云端拉取、上传或提示冲突。</p>
                </div>
              </div>
              <div className="list">
                <article className="list-item">
                  <div>
                    <h3 className="word-title">当前状态</h3>
                    <p className="list-meta">{sync.statusLabel}</p>
                    <p className="list-meta">设备标识：{sync.metadata.deviceId}</p>
                    <p className="list-meta">上次远端更新时间：{formatDateTime(sync.metadata.lastRemoteUpdatedAt)}</p>
                  </div>
                  <div className="list-item-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void syncControls.syncNow()}
                      disabled={sync.isBusy || !sync.isOnline || sync.status === 'needs-initial-upload'}
                    >
                      立即同步
                    </button>
                    <button type="button" className="button-secondary" onClick={() => void syncControls.signOut()}>
                      退出登录
                    </button>
                  </div>
                </article>
              </div>
            </section>

            {sync.status === 'needs-initial-upload' ? (
              <section className="panel">
                <h2>首次上传确认</h2>
                <p className="help-text">
                  检测到当前账号云端还没有快照，但本机已有学习数据。v1 只会在你手动点击后上传，请先确认是否要把这台设备的数据作为初始云端快照。
                </p>
                <div className="button-row" style={{ marginTop: '12px' }}>
                  <button type="button" className="button" onClick={() => void syncControls.confirmInitialUpload()} disabled={sync.isBusy || !sync.isOnline}>
                    确认上传本机数据
                  </button>
                </div>
              </section>
            ) : null}

            {sync.conflict ? (
              <section className="panel">
                <h2>检测到冲突</h2>
                <p className="help-text">
                  本机和云端在上次同步后都发生了变化。v1 不做自动合并，请手动选择保留哪一份快照。
                </p>
                <div className="grid grid-2" style={{ marginTop: '16px' }}>
                  <article className="notice">
                    <h3>使用云端数据</h3>
                    <p className="help-text">会用云端快照覆盖当前设备的本地数据。</p>
                    <div className="button-row" style={{ marginTop: '12px' }}>
                      <button type="button" className="button-secondary" onClick={() => void syncControls.resolveConflictUseRemote()}>
                        使用云端数据
                      </button>
                    </div>
                  </article>
                  <article className="notice">
                    <h3>使用本机数据</h3>
                    <p className="help-text">会用当前设备的数据覆盖云端快照。</p>
                    <div className="button-row" style={{ marginTop: '12px' }}>
                      <button type="button" className="button" onClick={() => void syncControls.resolveConflictUseLocal()} disabled={sync.isBusy || !sync.isOnline}>
                        使用本机覆盖云端
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {sync.errorMessage ? (
          <section className="notice notice-error">
            <div className="section-heading">
              <div>
                <h2>同步错误</h2>
                <p className="section-subtitle">{sync.errorMessage}</p>
              </div>
              <button type="button" className="button-link" onClick={syncControls.clearError}>
                关闭
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </HydrationGate>
  );
}
