import React, { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { useSoleNet } from '../hooks/useSoleNet';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import Img from '../components/Img';
import type { SoleNetPost, SoleNetDm } from '../types/social';

const POST_ACCENT: Record<SoleNetPost['type'], string> = {
    chatter: 'var(--line)',
    rumor: 'var(--accent-2)',
    ad: 'var(--warn)',
    event: 'var(--bad)',
    chaos: 'var(--ink-faint)',
};

const POST_LABEL: Record<SoleNetPost['type'], string> = {
    chatter: '',
    rumor: 'Rumour',
    ad: 'Promoted',
    event: 'Breaking',
    chaos: 'Unhinged',
};

const DM_ACCENT: Record<SoleNetDm['type'], string> = {
    flavor: 'var(--ink-faint)',
    tip: 'var(--ok)',
    scam: 'var(--bad)',
    mission: 'var(--warn)',
};

const timeAgo = (ts: number): string => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
};

const PostCard: React.FC<{ post: SoleNetPost }> = ({ post }) => (
    <article className="panel p-3 border-l-2" style={{ borderLeftColor: POST_ACCENT[post.type] }}>
        <div className="flex items-start gap-2.5">
            <Img fallback="🧍" src={post.author.avatarUrl} alt="" className="w-9 h-9 rounded-full border border-[var(--line)] flex-shrink-0 saturate-50" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{post.author.handle}</span>
                    <span className="label">{timeAgo(post.timestamp)}</span>
                    {POST_LABEL[post.type] && (
                        <span className="chip !text-[9px] !py-0" style={{ borderColor: POST_ACCENT[post.type], color: POST_ACCENT[post.type] }}>
                            {POST_LABEL[post.type]}
                        </span>
                    )}
                </div>
                <p className="text-sm text-[var(--ink)] mt-1 leading-snug">{post.content}</p>
                <div className="flex gap-4 mt-2 label">
                    <span>🔥 {post.likes}</span>
                    <span>💬 {Math.floor(post.reposts / 2)}</span>
                    <span>↻ {post.reposts}</span>
                </div>
            </div>
        </div>
    </article>
);

const Inbox: React.FC<{ dms: SoleNetDm[]; onClose: () => void }> = ({ dms, onClose }) => (
    <div className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm" onClick={onClose}>
        <div
            className="absolute top-0 right-0 h-full w-full max-w-md bg-[var(--bg-panel)] border-l border-[var(--line-bright)] flex flex-col animate-slide-in"
            onClick={e => e.stopPropagation()}
        >
            <div className="panel-head flex-shrink-0">
                <span className="font-display text-sm uppercase text-[var(--accent)]">Underground Inbox</span>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
                {dms.map(dm => (
                    <div key={dm.id} className="flex items-start gap-3 p-3">
                        <div className="relative flex-shrink-0">
                            <Img fallback="🧍" src={dm.sender.avatarUrl} alt="" className="w-10 h-10 rounded-full saturate-50" />
                            {!dm.isRead && (
                                <span
                                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-panel)]"
                                    style={{ background: DM_ACCENT[dm.type] }}
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-semibold text-white truncate">{dm.sender.handle}</span>
                                <span className="chip !text-[9px] !py-0" style={{ borderColor: DM_ACCENT[dm.type], color: DM_ACCENT[dm.type] }}>
                                    {dm.type}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--ink-dim)] mt-0.5 leading-snug">{dm.messages[0].text}</p>
                        </div>
                    </div>
                ))}
            </div>
            <p className="label p-3 border-t border-[var(--line)] flex-shrink-0">
                Tips are sometimes true. Scams never are. Good luck telling them apart.
            </p>
        </div>
    </div>
);

type Tab = 'all' | 'rumor' | 'chaos';

/**
 * SoleNet. Retinted onto the shared palette and given filters, because the feed
 * is where rumours live and scrolling 30 undifferentiated posts to find one was
 * the opposite of useful.
 */
const SocialScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { posts, dms } = useSoleNet();
    const [showInbox, setShowInbox] = useState(false);
    const [tab, setTab] = useState<Tab>('all');

    const unread = dms.filter(d => !d.isRead).length;
    const filtered = tab === 'all' ? posts : posts.filter(p => p.type === tab);

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Sole<span className="accent">Net</span></>}
                subtitle="Everyone is lying, some of them usefully"
                back={Screen.Dashboard}
                actions={
                    <>
                        <button className="btn btn-sm" onClick={() => changeScreen(Screen.CityFeed)}>Street Intel</button>
                        <button className="btn btn-sm relative" onClick={() => setShowInbox(true)}>
                            Inbox
                            {unread > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-2)] text-black text-[9px] font-bold flex items-center justify-center">
                                    {unread}
                                </span>
                            )}
                        </button>
                    </>
                }
            />

            <div className="flex gap-1.5 mb-3">
                {([['all', 'HypeLine'], ['rumor', 'Rumours'], ['chaos', 'Unhinged']] as [Tab, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)} className={`btn btn-sm ${tab === id ? 'btn-primary' : ''}`}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <div className="panel p-8 text-center text-[var(--ink-dim)] font-mono text-sm">Nothing in this filter today.</div>
                ) : (
                    filtered.map(post => <PostCard key={post.id} post={post} />)
                )}
            </div>

            {showInbox && <Inbox dms={dms} onClose={() => setShowInbox(false)} />}
        </div>
    );
};

export default SocialScreen;
