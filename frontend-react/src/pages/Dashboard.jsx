import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowUpRight,
  BellDot,
  ChevronRight,
  Landmark,
  LineChart,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

const tickerTape = [
  'VN-INDEX 1,250.32 (+1.5%)',
  'HNX 237.14 (+0.8%)',
  'UPCOM 92.77 (-0.2%)',
  'Thanh khoan 20,000 ty',
]

const performanceData = [
  { date: '01/04', nav: 281.2, vnindex: 1210 },
  { date: '03/04', nav: 286.5, vnindex: 1218 },
  { date: '05/04', nav: 289.8, vnindex: 1221 },
  { date: '07/04', nav: 294.4, vnindex: 1226 },
  { date: '09/04', nav: 300.6, vnindex: 1233 },
  { date: '11/04', nav: 308.9, vnindex: 1241 },
  { date: '13/04', nav: 314.7, vnindex: 1247 },
  { date: '15/04', nav: 320.1, vnindex: 1250 },
]

const signalFeed = [
  {
    ticker: 'HPG',
    filter: 'Bo loc Gia sinh vien',
    time: '2 phut truoc',
    status: 'Mua manh',
  },
  {
    ticker: 'MBB',
    filter: 'Bo loc An chac mac ben',
    time: '8 phut truoc',
    status: 'Theo doi',
  },
  {
    ticker: 'FPT',
    filter: 'Bo loc Tang truong ben vung',
    time: '15 phut truoc',
    status: 'Mua manh',
  },
  {
    ticker: 'DGC',
    filter: 'Bo loc Chat luong cao',
    time: '27 phut truoc',
    status: 'Theo doi',
  },
]

const watchlist = [
  { symbol: 'FPT', company: 'FPT', price: 124500, change: 2.35 },
  { symbol: 'HPG', company: 'Hoa Phat', price: 30200, change: 1.42 },
  { symbol: 'VCB', company: 'Vietcombank', price: 89500, change: -0.71 },
  { symbol: 'MWG', company: 'The Gioi Di Dong', price: 68300, change: 3.16 },
  { symbol: 'SSI', company: 'SSI Securities', price: 35400, change: -1.18 },
]

function formatVnd(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VND`
}

function formatCompactVnd(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VND`
}

function statusClass(status) {
  if (status === 'Mua manh') {
    return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
  }

  return 'border-sky-400/30 bg-sky-400/15 text-sky-200'
}

export default function Dashboard() {
  const tickerLine = tickerTape.join('    |    ')

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Good Morning</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-100">Hello, Nguyen Anh</h1>
          </div>

          <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-slate-200 transition-colors hover:bg-white/10">
            <BellDot className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime-400" />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-emerald-400/10 px-4 py-3">
          <motion.div
            className="flex whitespace-nowrap text-sm font-medium text-cyan-100/90"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            <span className="pr-10">{tickerLine}</span>
            <span>{tickerLine}</span>
          </motion.div>
        </div>
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="space-y-5 xl:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a2438]/85 via-[#111827]/85 to-[#0d111a]/90 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tong quan tai san</p>
                <p className="mt-3 text-3xl font-bold text-white md:text-4xl">{formatVnd(320126000)}</p>
                <p className="mt-2 text-sm font-medium text-emerald-300">+15% from last month</p>
              </div>

              <div className="rounded-2xl border border-lime-300/30 bg-lime-300/10 p-3 text-lime-200">
                <Landmark className="h-6 w-6" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Performance Chart</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Hieu qua danh muc</h2>
              </div>
              <LineChart className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="benchmarkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#1f2937" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b1220',
                      border: '1px solid rgba(71, 85, 105, 0.65)',
                      borderRadius: '12px',
                    }}
                    formatter={(value, name) => {
                      if (name === 'nav') return [`${Number(value).toLocaleString('vi-VN')} trieu`, 'NAV']
                      return [Number(value).toLocaleString('vi-VN'), 'VN-Index']
                    }}
                    labelFormatter={(label) => `Ngay: ${label}`}
                  />

                  <Area
                    type="monotone"
                    dataKey="nav"
                    name="nav"
                    stroke="#4ade80"
                    strokeWidth={2.2}
                    fill="url(#portfolioFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="vnindex"
                    name="vnindex"
                    stroke="#38bdf8"
                    strokeWidth={2.2}
                    fill="url(#benchmarkFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="inline-flex items-center gap-2 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Hieu qua danh muc
              </div>
              <div className="inline-flex items-center gap-2 text-sky-300">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                VN-INDEX benchmark
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tin hieu moi nhat</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Tu cac bo loc du lieu bao cao</h2>
              </div>
              <a href="/screener" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
                Mo Screener
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="space-y-2">
              {signalFeed.map((item) => (
                <div
                  key={`${item.ticker}-${item.time}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">{item.ticker}</p>
                    <p className="text-xs text-slate-400">{item.filter}</p>
                  </div>

                  <p className="text-xs text-slate-500">{item.time}</p>

                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                    [{item.status}]
                  </span>

                  <button className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20">
                    Xem chi tiet
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="space-y-5 xl:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Suc mua & Tai khoan</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Thong tin giao dich</h2>
              </div>
              <Wallet className="h-5 w-5 text-lime-300" />
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs text-slate-500">Tien mat co san (Cash)</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{formatVnd(64500000)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs text-slate-500">Suc mua toi da (Purchasing Power)</p>
                <p className="mt-1 text-lg font-semibold text-cyan-200">{formatVnd(189600000)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Ty le ky quy (Margin Ratio)</p>
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </div>
                <p className="mt-1 text-lg font-semibold text-emerald-300">31.5%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Watchlist</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">Danh muc quan tam</h2>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </div>

            <div className="space-y-2">
              {watchlist.map((stock) => {
                const positive = stock.change >= 0

                return (
                  <div
                    key={stock.symbol}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-xs font-semibold text-slate-100">
                        {stock.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{stock.symbol}</p>
                        <p className="text-xs text-slate-500">{stock.company}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-100">{formatCompactVnd(stock.price)}</p>
                      <p className={`text-xs font-medium ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
                        {positive ? '+' : ''}{stock.change.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
