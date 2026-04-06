'use client'

import { useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Store,
  Zap,
  Shield,
  ShieldCheck,
  Lock,
  Eye,
  Fingerprint,
  BarChart3,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Users,
  Smartphone,
  Database,
  Timer,
  Gauge,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Package,
  Tag,
  Bell,
  FileSpreadsheet,
  Layers,
  Star,
} from 'lucide-react'

// ─── ANIMATIONS ────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
}

// ─── SECTION WRAPPER ───────────────────────────────────────

function Section({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

// ─── DATA ──────────────────────────────────────────────────

const navLinks = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Keamanan', href: '#keamanan' },
  { label: 'Kecepatan', href: '#kecepatan' },
  { label: 'FAQ', href: '#faq' },
]

const features = [
  { icon: ShoppingCart, title: 'Kasir Cepat', desc: 'Proses transaksi dalam hitungan detik. Scan barcode, pilih produk, bayar — selesai.' },
  { icon: Package, title: 'Manajemen Produk', desc: 'Kelola ribuan produk dengan varian (ukuran, warna), kategori, dan tracking stok real-time.' },
  { icon: Tag, title: 'Promo & Diskon', desc: 'Buat promo persenase, nominal, atau beli X gratis Y. Atur syarat minimum pembelian.' },
  { icon: Users, title: 'Customer Management', desc: 'Database pelanggan otomatis dengan program loyalitas poin dan tracking pembelian.' },
  { icon: BarChart3, title: 'Dashboard AI', desc: 'Insight cerdas otomatis: tren penjualan, produk terlaris, prediksi revenue, dan rekomendasi.' },
  { icon: Receipt, title: 'Struk & Laporan', desc: 'Cetak struk langsung. Export laporan ke Excel/PDF. Laporan harian, mingguan, bulanan.' },
  { icon: Bell, title: 'Notifikasi Telegram', desc: 'Notif otomatis ke Telegram untuk setiap transaksi, perubahan insight, dan stok menipis.' },
  { icon: Layers, title: 'Multi-Varian Produk', desc: 'Produk dengan varian berbeda — ukuran S/M/L/XL, warna, atau tipe — masing-masing punya harga & stok.' },
]

const securityFeatures = [
  { icon: Lock, title: 'Enkripsi End-to-End', desc: 'Semua data dienkripsi menggunakan standar industri. Password di-hash dengan bcrypt + JWT secure token.' },
  { icon: Shield, title: 'Rate Limiting', desc: 'Perlindungan dari brute force attack. Login dibatasi 5x/menit per email, registrasi 3x/menit per IP.' },
  { icon: Fingerprint, title: 'Session Management', desc: 'Sesi otomatis expire dalam 7 hari. Ubah password? Semua sesi lama langsung di-invalidate.' },
  { icon: Eye, title: 'Audit Log Lengkap', desc: 'Setiap aksi penting (login, perubahan harga, void transaksi) tercatat lengkap dengan timestamp.' },
  { icon: ShieldCheck, title: 'Password Policy', desc: 'Minimal 8 karakter, kombinasi huruf besar, kecil, dan angka. Keamanan level enterprise.' },
  { icon: Database, title: 'Data Backup', desc: 'Database PostgreSQL di-hosting terpisah (Neon). Auto backup dan high-availability 99.9%.' },
]

const speedFeatures = [
  { icon: Zap, title: 'Instant Checkout', desc: 'Bayar → struk preview muncul dalam < 100ms. Sync ke server berjalan di background, nggak nunggu.' },
  { icon: Gauge, title: 'Single API Dashboard', desc: 'Dashboard, insight, dan forecast dimuat dalam 1 request paralel. 3 API dimerge jadi 1.' },
  { icon: Timer, title: 'Smart Cache', desc: 'TanStack Query cache 30 detik + background refetch. Data tetap fresh tanpa reload berulang.' },
  { icon: Smartphone, title: 'Offline Mode', desc: 'Tetap bisa transaksi walau internet mati. Data tersimpan lokal, auto-sync saat online lagi.' },
]

const faqs = [
  {
    q: 'Apakah Aether POS gratis?',
    a: 'Ya! Aether POS punya paket Free yang sudah cukup untuk UMKM. Fitur dasar seperti kasir, manajemen produk, customer, dan laporan tersedia gratis tanpa batas waktu. Upgrade ke Pro untuk fitur advanced seperti upload Excel, AI insight, dan multi-outlet.',
  },
  {
    q: 'Apakah bisa digunakan tanpa internet?',
    a: 'Bisa! Aether POS punya mode offline. Saat internet mati, transaksi tetap bisa diproses dan disimpan di perangkat. Begitu online lagi, semua data otomatis sync ke server. Cocok untuk toko yang koneksi internet-nya tidak stabil.',
  },
  {
    q: 'Bagaimana keamanan data saya?',
    a: 'Keamanan adalah prioritas kami. Password di-hash dengan bcrypt, sesi dienkripsi JWT, dan rate limiting melindungi dari serangan. Semua aksi penting tercatat di audit log. Database di-hosting di Neon PostgreSQL dengan backup otomatis.',
  },
  {
    q: 'Bisa pakai di HP atau tablet?',
    a: 'Tentu! Aether POS fully responsive — berfungsi optimal di desktop, tablet, maupun smartphone. Kasir bisa pakai tablet, owner pantau dashboard dari HP. Satu akun bisa login di beberapa perangkat.',
  },
  {
    q: 'Berapa produk yang bisa saya kelola?',
    a: 'Paket Free mendukung hingga 100 produk. Paket Pro mendukung unlimited produk. Setiap produk bisa punya varian (ukuran, warna) dengan harga dan stok masing-masing.',
  },
  {
    q: 'Apakah ada notifikasi otomatis?',
    a: 'Ya! Anda bisa hubungkan Telegram bot untuk menerima notifikasi otomatis: setiap transaksi baru, perubahan insight AI, stok menipis, dan laporan harian/mingguan/bulanan. Semua bisa diatur di halaman Settings.',
  },
]

// ─── COMPONENT ─────────────────────────────────────────────

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
}

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Store className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-50">Aether POS</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800/50 transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <Button variant="ghost" onClick={onLogin} className="text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-9 px-4">
              Masuk
            </Button>
            <Button onClick={onRegister} className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-sm font-medium px-4 rounded-lg shadow-lg shadow-emerald-500/20">
              Coba Gratis
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800/60 px-4 pb-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800/50"
              >
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/60">
              <Button variant="ghost" onClick={() => { onLogin(); setMobileMenuOpen(false) }} className="flex-1 text-sm h-9">
                Masuk
              </Button>
              <Button onClick={() => { onRegister(); setMobileMenuOpen(false) }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-sm">
                Coba Gratis
              </Button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <header className="relative pt-16">
        {/* BG effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute top-20 right-0 w-[300px] h-[300px] bg-emerald-500/[0.03] rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
              <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 px-4 py-1.5 text-xs font-medium rounded-full mb-6">
                <Sparkles className="mr-1.5 h-3 w-3" />
                Solusi POS #1 untuk UMKM Indonesia
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
            >
              Kelola Toko Anda{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400">
                Lebih Cerdas
              </span>
              <br />
              dengan Aether POS
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed"
            >
              Sistem kasir modern yang ringan, aman, dan super cepat. Dari transaksi harian
              sampai analisis bisnis — semua dalam satu dashboard.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
            >
              <Button
                size="lg"
                onClick={onRegister}
                className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 px-8 text-sm font-semibold rounded-xl shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:shadow-emerald-500/35 hover:scale-[1.02]"
              >
                Mulai Gratis Sekarang
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onLogin}
                className="border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-zinc-600 h-12 px-8 text-sm font-medium rounded-xl"
              >
                Sudah punya akun? Masuk
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Gratis selamanya
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Tanpa kartu kredit
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Setup 2 menit
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Offline-ready
              </span>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            custom={5}
            initial="hidden"
            animate="visible"
            className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {[
              { value: '10K+', label: 'Transaksi/hari' },
              { value: '99.9%', label: 'Uptime Server' },
              { value: '< 100ms', label: 'Waktu Checkout' },
              { value: '24/7', label: 'Monitoring' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-zinc-50 tracking-tight">{stat.value}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* ─── FEATURES ─── */}
      <Section id="fitur" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge className="bg-zinc-800 border-zinc-700 text-zinc-300 px-3 py-1 text-[11px] font-medium rounded-full mb-4">
              Fitur Lengkap
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Semua yang UMKM butuhkan
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
              Dari kasir hingga laporan keuangan — Aether POS punya fitur lengkap untuk mengelola bisnis Anda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={scaleIn}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition-all duration-300 hover:border-emerald-500/20 hover:bg-zinc-900/90"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-emerald-500/15 group-hover:scale-105">
                  <feature.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1.5">{feature.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── SECURITY ─── */}
      <Section id="keamanan" className="py-20 sm:py-28 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Content */}
            <div>
              <Badge className="bg-rose-500/10 border-rose-500/20 text-rose-400 px-3 py-1 text-[11px] font-medium rounded-full mb-4">
                <ShieldCheck className="mr-1.5 h-3 w-3" />
                Keamanan Enterprise
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Data bisnis Anda{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
                  terlindungi penuh
                </span>
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base mb-8 leading-relaxed">
                Keamanan bukan opsi — ini keharusan. Aether POS menggunakan standar keamanan
                level enterprise untuk melindungi setiap transaksi dan data pelanggan Anda.
              </p>

              <div className="space-y-4">
                {securityFeatures.slice(0, 3).map((item, i) => (
                  <motion.div
                    key={item.title}
                    variants={fadeUp}
                    custom={i}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="flex gap-4 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60 transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100 mb-0.5">{item.title}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right - Visual */}
            <div className="relative">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 sm:p-8 overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />

                <div className="relative space-y-5">
                  {securityFeatures.slice(3).map((item, i) => (
                    <motion.div
                      key={item.title}
                      variants={fadeUp}
                      custom={i + 3}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      className="flex gap-4 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60 transition-all duration-200"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4.5 h-4.5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100 mb-0.5">{item.title}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Security score */}
                  <motion.div
                    variants={fadeUp}
                    custom={6}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="mt-4 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-emerald-400">Skor Keamanan</span>
                      <span className="text-xs font-bold text-emerald-400">8.5 / 10</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: '85%' }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5">Diukur berdasarkan OWASP Top 10 checklist</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── SPEED ─── */}
      <Section id="kecepatan" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 px-3 py-1 text-[11px] font-medium rounded-full mb-4">
              <Zap className="mr-1.5 h-3 w-3" />
              Performa Tinggi
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Cepat. Sangat cepat.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
              Setiap milidetik berharga saat antrian kasir mengular. Aether POS dioptimasi untuk kecepatan maksimal.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {speedFeatures.map((item, i) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                className="group p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:border-emerald-500/20 hover:bg-zinc-900/90 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Performance comparison */}
          <motion.div
            variants={fadeUp}
            custom={4}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-14 max-w-2xl mx-auto"
          >
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6">
              <h3 className="text-sm font-semibold text-zinc-200 mb-5 text-center">Perbandingan Kecepatan</h3>
              <div className="space-y-4">
                {[
                  { label: 'Aether POS', value: 95, color: 'from-emerald-500 to-emerald-400', time: '< 100ms' },
                  { label: 'POS Konvensional', value: 45, color: 'from-zinc-600 to-zinc-500', time: '~2-3 detik' },
                  { label: 'POS Lainnya', value: 60, color: 'from-zinc-500 to-zinc-400', time: '~1-2 detik' },
                ].map((bar, i) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 font-medium">{bar.label}</span>
                      <span className={`text-xs font-semibold ${i === 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>{bar.time}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.value}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ─── UMKM BENEFITS ─── */}
      <Section className="py-20 sm:py-28 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <Badge className="bg-violet-500/10 border-violet-500/20 text-violet-400 px-3 py-1 text-[11px] font-medium rounded-full mb-4">
              Dibuat untuk UMKM
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Kenapa UMKM pilih Aether POS?
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                emoji: '🆓',
                title: 'Gratis & Tanpa Ribet',
                desc: 'Paket free tanpa batas waktu. Daftar 2 menit, langsung pakai. Nggak perlu kartu kredit.',
              },
              {
                emoji: '📱',
                title: 'Akses dari Mana Saja',
                desc: 'Owner pantau toko dari HP. Kasir pakai tablet. Satu akun untuk semua perangkat.',
              },
              {
                emoji: '📊',
                title: 'Pintar Tanpa Ribet',
                desc: 'Dashboard otomatis kasih insight. Tau produk laris, stok menipis, dan tren penjualan.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                variants={scaleIn}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="text-center p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700/60 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{item.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── FAQ ─── */}
      <Section id="faq" className="py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge className="bg-zinc-800 border-zinc-700 text-zinc-300 px-3 py-1 text-[11px] font-medium rounded-full mb-4">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Pertanyaan yang Sering Ditanyakan
            </h2>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <motion.div key={i} variants={fadeUp} custom={i}>
                  <AccordionItem value={`faq-${i}`} className="border-zinc-800/80 rounded-xl px-5 data-[state=open]:bg-zinc-900/60 transition-colors duration-200">
                    <AccordionTrigger className="text-sm font-medium text-zinc-200 hover:text-zinc-100 hover:no-underline py-4">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-zinc-400 leading-relaxed pb-4">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </Section>

      {/* ─── FINAL CTA ─── */}
      <Section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            variants={scaleIn}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 p-8 sm:p-12 relative overflow-hidden"
          >
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-emerald-500/[0.06] rounded-full blur-[100px]" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                Siap meningkatkan bisnis Anda?
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto mb-8">
                Bergabung dengan ribuan UMKM yang sudah pakai Aether POS. Gratis, aman, dan super cepat.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={onRegister}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 px-8 text-sm font-semibold rounded-xl shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:shadow-emerald-500/35 hover:scale-[1.02]"
                >
                  Daftar Gratis Sekarang
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onLogin}
                  className="border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 hover:border-zinc-600 h-12 px-8 text-sm font-medium rounded-xl"
                >
                  Masuk ke Dashboard
                </Button>
              </div>

              <p className="text-[11px] text-zinc-600 mt-6">
                Gratis selamanya &bull; Tanpa kartu kredit &bull; Setup dalam 2 menit
              </p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-zinc-800/60 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Store className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-zinc-300">Aether POS</span>
            </div>

            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  {link.label}
                </a>
              ))}
            </div>

            <p className="text-[11px] text-zinc-600">
              &copy; {new Date().getFullYear()} Aether POS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
