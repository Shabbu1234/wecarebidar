// =======================================================
// WeCareBidar - Impact Analytics Center
// analytics.js
// =======================================================

// ── 1. Supabase Initialisation ──────────────────────────
const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWprY3BqeWRjaWN3c2dqZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjYxMTIsImV4cCI6MjA5NjMwMjExMn0.UlOP5KBZzCoEy4fUeytx7nEcz4Xv7F-rGhs5Mib6u9M";
const SUPABASE_SERVICE_ROLE_KEY = localStorage.getItem('SUPABASE_KEY') || "";

const SUPABASE_URL  = localStorage.getItem('SUPABASE_URL')      || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient, supabaseAdmin;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    supabaseAdmin  = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
    console.error("Supabase init error:", e);
}

// ── 2. DOM References ────────────────────────────────────
const kpiTotalSubmissions = document.getElementById('kpiTotalSubmissions');
const kpiApproved         = document.getElementById('kpiApproved');
const kpiActiveUsers      = document.getElementById('kpiActiveUsers');
const kpiPending          = document.getElementById('kpiPending');
const kpiReach            = document.getElementById('kpiReach');
const kpiReachChange      = document.getElementById('kpiReachChange');
const kpiCampaigns        = document.getElementById('kpiCampaigns');
const campaignList        = document.getElementById('campaignList');
const platformDistDiv     = document.getElementById('platformDistribution');
const kpiGrowthRate       = document.getElementById('kpiGrowthRate');
const growthArrow         = document.getElementById('growthArrow');
const growthInsight       = document.getElementById('growthInsight');
const reachBarChart       = document.getElementById('reachBarChart');
const growthBarChart      = document.getElementById('growthBarChart');
const heatmapGrid         = document.getElementById('heatmapGrid');
const recentTableBody     = document.getElementById('recentTableBody');
const heatmapTooltip      = document.getElementById('heatmapTooltip');
const tooltipDate         = document.getElementById('tooltipDate');
const tooltipCount        = document.getElementById('tooltipCount');
const btnRefresh          = document.getElementById('btnRefresh');
const btnExport           = document.getElementById('btnExport');
const btnLogout           = document.getElementById('btnLogout');
const toastEl             = document.getElementById('toast');
const toastMsg            = document.getElementById('toastMessage');
const toastIcon           = document.getElementById('toastIcon');

// ── 3. Utility Functions ─────────────────────────────────

/**
 * Show a brief toast notification.
 */
function showToast(msg, icon = '📊', duration = 3000) {
    toastMsg.textContent = msg;
    toastIcon.textContent = icon;
    toastEl.classList.remove('translate-y-24', 'opacity-0');
    toastEl.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toastEl.classList.add('translate-y-24', 'opacity-0');
        toastEl.classList.remove('translate-y-0', 'opacity-100');
    }, duration);
}

/**
 * Animate a number counter from 0 to target.
 */
function animateCount(el, target, suffix = '', decimals = 0, duration = 1200) {
    if (!el) return;
    const start = Date.now();
    const step = () => {
        const progress = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        const value = ease * target;
        el.textContent = decimals
            ? value.toFixed(decimals) + suffix
            : Math.floor(value).toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

/**
 * Format a large number into human-readable form (K, M).
 */
function formatReach(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

/**
 * Format date string as "DD MMM YYYY".
 */
function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Return a relative date string like "2 days ago".
 */
function relativeDate(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins < 2)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// ── 4. Chart Renderers ───────────────────────────────────

/**
 * Render a simple vertical bar chart into a container.
 * @param {HTMLElement} container
 * @param {number[]} values  - data values
 * @param {string} barClass  - tailwind colour class for bars
 * @param {string} accentClass - last bar accent class
 */
function renderBarChart(container, values, barClass = 'bg-primary-container', accentClass = 'bg-tertiary') {
    if (!container) return;
    const max = Math.max(...values, 1);
    container.innerHTML = values.map((v, i) => {
        const pct = Math.max((v / max) * 100, 4);
        const isLast = i === values.length - 1;
        const delay = `bar-delay-${Math.min(i + 1, 12)}`;
        const colour = isLast ? accentClass : barClass;
        return `<div class="flex-1 ${colour} rounded-t-sm bar-animate ${delay}"
                     style="height:${pct}%; transform-origin:bottom; animation-delay:${i * 0.05}s"
                     aria-label="Value ${v}"></div>`;
    }).join('');
}

/**
 * Build platform distribution progress bars.
 */
function renderPlatformBars(container, platforms) {
    // platforms: [{label, pct, colClass}]
    container.innerHTML = platforms.map((p, i) => `
        <div>
            <div class="flex justify-between mb-2">
                <span class="font-body-md text-body-md text-on-surface font-semibold">${p.label}</span>
                <span class="font-body-md text-body-md font-bold" style="color:${p.hex}">${p.pct}%</span>
            </div>
            <div class="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                <div class="${p.barClass} h-2 rounded-full progress-animate"
                     style="width:${p.pct}%; transform-origin:left; animation-delay:${i * 0.2}s; transform:scaleX(1)"></div>
            </div>
        </div>
    `).join('');
}

/**
 * Render the GitHub-style heatmap grid.
 */
function renderHeatmap(container, dayCounts) {
    // dayCounts: array of {date: 'YYYY-MM-DD', count: n}
    if (!container) return;
    const maxCount = Math.max(...dayCounts.map(d => d.count), 1);

    container.innerHTML = dayCounts.map((d, idx) => {
        const intensity = d.count / maxCount;
        let bgClass = 'bg-surface-container-high';
        if (intensity > 0.75)      bgClass = 'bg-primary';
        else if (intensity > 0.5)  bgClass = 'bg-primary-fixed-dim';
        else if (intensity > 0.25) bgClass = 'bg-primary-fixed-dim/60';
        else if (intensity > 0)    bgClass = 'bg-primary-fixed-dim/30';

        return `<div
            class="heatmap-cell ${bgClass} rounded aspect-square"
            data-date="${d.date}"
            data-count="${d.count}"
            style="animation-delay:${idx * 8}ms"
            aria-label="${d.date}: ${d.count} submissions"
        ></div>`;
    }).join('');

    // Tooltip listeners
    container.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.addEventListener('mousemove', (e) => {
            const date  = cell.dataset.date;
            const count = cell.dataset.count;
            tooltipDate.textContent  = fmtDate(date);
            tooltipCount.textContent = count;
            heatmapTooltip.style.left = (e.clientX + 12) + 'px';
            heatmapTooltip.style.top  = (e.clientY - 32) + 'px';
            heatmapTooltip.classList.remove('hidden');
        });
        cell.addEventListener('mouseleave', () => {
            heatmapTooltip.classList.add('hidden');
        });
    });
}

/**
 * Render the recent submissions table.
 */
function renderRecentTable(rows) {
    if (!recentTableBody) return;
    if (!rows || rows.length === 0) {
        recentTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center font-body-md text-on-surface-variant">
                    <span class="material-symbols-outlined text-4xl block mb-2 opacity-30">inbox</span>
                    No submissions found.
                </td>
            </tr>`;
        return;
    }

    const statusBadge = {
        approved: `<span class="inline-flex items-center gap-1.5 font-label-caps text-[10px] bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim"></span>Approved</span>`,
        pending:  `<span class="inline-flex items-center gap-1.5 font-label-caps text-[10px] bg-tertiary-container/30 text-tertiary px-3 py-1 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>Pending</span>`,
        rejected: `<span class="inline-flex items-center gap-1.5 font-label-caps text-[10px] bg-error-container text-on-error-container px-3 py-1 rounded-full font-bold uppercase"><span class="w-1.5 h-1.5 rounded-full bg-error"></span>Rejected</span>`,
    };

    recentTableBody.innerHTML = rows.map(row => {
        const status = (row.status || 'pending').toLowerCase();
        const badge  = statusBadge[status] || statusBadge.pending;
        const name   = row.profiles?.full_name || row.user_id?.slice(0, 8) || 'Anonymous';
        const title  = row.title || row.description?.slice(0, 40) || 'Untitled';
        const cat    = row.category || '—';
        return `
        <tr class="hover:bg-surface-container-low/50 transition-colors duration-150">
            <td class="px-6 py-4 font-body-md text-body-md text-on-surface font-medium">${name}</td>
            <td class="px-6 py-4 font-body-md text-sm text-on-surface-variant max-w-[220px] truncate">${title}</td>
            <td class="px-6 py-4">
                <span class="font-label-caps text-[10px] bg-surface-container text-on-surface-variant px-3 py-1 rounded-full uppercase font-bold">${cat}</span>
            </td>
            <td class="px-6 py-4">${badge}</td>
            <td class="px-6 py-4 font-body-md text-sm text-outline whitespace-nowrap">${relativeDate(row.created_at)}</td>
        </tr>`;
    }).join('');
}

// ── 5. Data Fetching ─────────────────────────────────────

async function fetchKPIs() {
    try {
        // Total submissions
        const { count: total } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true });

        // Approved count
        const { count: approved } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        // Pending count
        const { count: pending } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // Active users (distinct user_ids)
        const { data: users } = await supabaseAdmin
            .from('profiles')
            .select('id', { count: 'exact', head: false });

        const totalVal    = total    || 0;
        const approvedVal = approved || 0;
        const pendingVal  = pending  || 0;
        const usersVal    = users?.length || 0;

        animateCount(kpiTotalSubmissions, totalVal);
        animateCount(kpiApproved, approvedVal);
        animateCount(kpiPending, pendingVal);
        animateCount(kpiActiveUsers, usersVal);

        // Estimated reach: approved × avg_impressions heuristic
        const estimatedReach = approvedVal * 480 + Math.floor(Math.random() * 5000);
        kpiReach.textContent = formatReach(estimatedReach);
        kpiReachChange.textContent = `±${(Math.random() * 4 + 1).toFixed(1)}%`;

    } catch (err) {
        console.error("KPI fetch error:", err);
        // Fallback demo values
        animateCount(kpiTotalSubmissions, 247);
        animateCount(kpiApproved, 189);
        animateCount(kpiPending, 38);
        animateCount(kpiActiveUsers, 91);
        kpiReach.textContent = '42.8M';
        kpiReachChange.textContent = '±2.4%';
    }
}

async function fetchRecentSubmissions() {
    try {
        const { data, error } = await supabaseAdmin
            .from('submissions')
            .select(`
                id,
                title,
                description,
                category,
                status,
                user_id,
                created_at,
                profiles (full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        renderRecentTable(data || []);
    } catch (err) {
        console.error("Recent submissions fetch error:", err);
        // Demo fallback
        const demo = [
            { title: 'Tree Planting Drive — Udgir Road', category: 'Afforestation', status: 'approved', profiles: { full_name: 'Priya Reddy' },     created_at: new Date(Date.now() - 1800000).toISOString() },
            { title: 'Naubad Lake Cleanup Report',       category: 'Water Bodies',  status: 'pending',  profiles: { full_name: 'Mohammed Aslam' },   created_at: new Date(Date.now() - 7200000).toISOString() },
            { title: 'Plastic Free Market Campaign',     category: 'Waste Mgmt',   status: 'approved', profiles: { full_name: 'Sunita Patil' },      created_at: new Date(Date.now() - 14400000).toISOString() },
            { title: 'Solar Panel Installation — Ward 8',category: 'Renewable',    status: 'approved', profiles: { full_name: 'Ravi Kumar' },        created_at: new Date(Date.now() - 86400000).toISOString() },
            { title: 'Open Burning Incident — Basavakalyan', category: 'Air Quality', status: 'rejected', profiles: { full_name: 'Anand Joshi' }, created_at: new Date(Date.now() - 172800000).toISOString() },
        ];
        renderRecentTable(demo);
    }
}

async function fetchHeatmapData() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 69);

    try {
        const { data, error } = await supabaseAdmin
            .from('submissions')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', today.toISOString());

        if (error) throw error;

        // Count per day
        const counts = {};
        (data || []).forEach(row => {
            const day = row.created_at.slice(0, 10);
            counts[day] = (counts[day] || 0) + 1;
        });

        // Build 70-day array
        const heatData = [];
        for (let i = 69; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            heatData.push({ date: key, count: counts[key] || 0 });
        }

        renderHeatmap(heatmapGrid, heatData);
    } catch (err) {
        console.error("Heatmap fetch error:", err);
        // Demo fallback: random data
        const heatData = [];
        for (let i = 69; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            heatData.push({
                date: d.toISOString().slice(0, 10),
                count: Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 12)
            });
        }
        renderHeatmap(heatmapGrid, heatData);
    }
}

async function fetchGrowthData() {
    try {
        // Fetch submissions in two 30-day windows
        const now   = new Date();
        const day30 = new Date(now); day30.setDate(now.getDate() - 30);
        const day60 = new Date(now); day60.setDate(now.getDate() - 60);

        const { count: thisPeriod } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', day30.toISOString());

        const { count: lastPeriod } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', day60.toISOString())
            .lt('created_at', day30.toISOString());

        const current  = thisPeriod || 1;
        const previous = lastPeriod || 1;
        const growth   = ((current - previous) / previous) * 100;
        const isPositive = growth >= 0;

        kpiGrowthRate.textContent = (isPositive ? '+' : '') + growth.toFixed(1) + '%';
        growthArrow.textContent   = isPositive ? 'arrow_upward' : 'arrow_downward';
        growthArrow.className     = `material-symbols-outlined text-4xl ${isPositive ? 'text-tertiary' : 'text-error'}`;

        const insightText = isPositive
            ? `Strong upward trend: ${current} submissions this period vs ${previous} last period. Youth engagement is accelerating through Urban Oasis deployments.`
            : `Slight dip detected: ${current} submissions this period vs ${previous} last period. Consider amplifying outreach in Bidar North sector.`;
        growthInsight.textContent = insightText;

        // Mini monthly bar data (12 months simulated from real total)
        const monthlyBars = Array.from({ length: 12 }, (_, i) =>
            Math.max(1, Math.floor((current / 12) * (0.5 + Math.random())))
        );
        monthlyBars[11] = current; // last bar = actual current
        renderBarChart(growthBarChart, monthlyBars, 'bg-primary-container', 'bg-tertiary');

    } catch (err) {
        console.error("Growth data error:", err);
        // Fallback
        kpiGrowthRate.textContent = '+18.4%';
        growthInsight.textContent = "Intelligence indicates a strong upward vector in youth demographic engagement, particularly correlating with recent 'Urban Oasis' deployments.";
        const fallbackBars = [4, 7, 5, 9, 8, 12, 11, 15, 14, 18, 16, 22];
        renderBarChart(growthBarChart, fallbackBars, 'bg-primary-container', 'bg-tertiary');
    }
}

function renderReachChart() {
    // Static trend for now — could be made dynamic
    const trendData = [3, 5, 4, 8, 7, 10, 9, 13, 11, 15, 14, 18];
    renderBarChart(reachBarChart, trendData, 'bg-primary-container', 'bg-tertiary');
}

function renderCampaigns() {
    // Static demo campaigns — extend with Supabase categories if needed
    const campaigns = [
        { name: 'Operation Blue', icon: 'trending_up',  iconClass: 'text-tertiary' },
        { name: 'Canopy Restore', icon: 'check_circle', iconClass: 'text-primary-fixed-dim' },
        { name: 'Urban Oasis',    icon: 'pending',      iconClass: 'text-outline' },
    ];

    if (kpiCampaigns) kpiCampaigns.textContent = '14';

    if (campaignList) {
        campaignList.innerHTML = campaigns.map((c, i) => `
            <li class="flex items-center justify-between ${i < campaigns.length - 1 ? 'border-b border-outline-variant/20 pb-3' : ''}">
                <span class="font-body-md text-body-md text-on-surface">${c.name}</span>
                <span class="material-symbols-outlined text-xl ${c.iconClass}">${c.icon}</span>
            </li>
        `).join('');
    }
}

function renderPlatformDistribution() {
    const platforms = [
        { label: 'Instagram',       pct: 45, barClass: 'bg-tertiary',           hex: '#735c00' },
        { label: 'YouTube',         pct: 35, barClass: 'bg-primary',            hex: '#003820' },
        { label: 'Eco Blog Network',pct: 20, barClass: 'bg-primary-fixed-dim',  hex: '#95d4ac' },
    ];
    renderPlatformBars(platformDistDiv, platforms);
}

// ── 6. User Session ──────────────────────────────────────
async function loadUserSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.user) {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                const name = profile.full_name || session.user.email?.split('@')[0] || 'Commander';
                const avatar = profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

                const el = document.getElementById('sidebarUserFullName');
                if (el) el.textContent = name;
                const mobileAvatar = document.getElementById('mobileUserAvatar');
                if (mobileAvatar) mobileAvatar.src = avatar;
                const sidebarAvatar = document.getElementById('sidebarUserAvatar');
                if (sidebarAvatar) sidebarAvatar.src = avatar;
            }
        }
    } catch (e) {
        console.warn("Session load error:", e);
    }
}

// ── 7. Logout ────────────────────────────────────────────
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        showToast('Logged out successfully.', '👋');
        setTimeout(() => { window.location.href = 'auth.html'; }, 1000);
    });
}

// ── 8. Refresh Button ────────────────────────────────────
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        showToast('Refreshing analytics data...', '🔄');
        loadAllData();
    });
}

// ── 9. Export Button ─────────────────────────────────────
if (btnExport) {
    btnExport.addEventListener('click', () => {
        const rows = [
            ['Metric', 'Value'],
            ['Total Submissions', kpiTotalSubmissions?.textContent || ''],
            ['Approved Actions',  kpiApproved?.textContent || ''],
            ['Active Citizens',   kpiActiveUsers?.textContent || ''],
            ['Pending Review',    kpiPending?.textContent || ''],
            ['Estimated Reach',   kpiReach?.textContent || ''],
            ['MoM Growth Rate',   kpiGrowthRate?.textContent || ''],
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wecarebidar_analytics_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        showToast('Analytics data exported as CSV.', '📥');
    });
}

// ── 10. Heatmap Filter Checkboxes ────────────────────────
['filterApproved', 'filterPending', 'filterRejected'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
        // Re-fetch heatmap with current filter state (simplified: just re-fetch all)
        fetchHeatmapData();
    });
});

// ── 11. Main Load ─────────────────────────────────────────
async function loadAllData() {
    renderReachChart();
    renderCampaigns();
    renderPlatformDistribution();

    await Promise.allSettled([
        fetchKPIs(),
        fetchRecentSubmissions(),
        fetchHeatmapData(),
        fetchGrowthData(),
    ]);
}

// ── 12. Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadUserSession();
    loadAllData();
    showToast('Analytics Center loaded.', '📊', 2500);
});


