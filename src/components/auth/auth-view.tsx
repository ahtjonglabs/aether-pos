'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Store, Loader2, Crown } from 'lucide-react'

export default function AuthView() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regOutletName, setRegOutletName] = useState('')
  const [regOwnerName, setRegOwnerName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Login successful')
      }
    } catch {
      toast.error('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regOutletName || !regOwnerName || !regEmail || !regPassword) {
      toast.error('Semua field wajib diisi')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletName: regOutletName,
          ownerName: regOwnerName,
          email: regEmail,
          password: regPassword,
          accountType: 'free',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Registrasi berhasil! Silakan masuk.')
        setMode('login')
        setLoginEmail(regEmail)
        setLoginPassword('')
      } else {
        toast.error(data.error || 'Registrasi gagal')
      }
    } catch {
      toast.error('Registrasi gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Store className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Aether POS</h1>
            <p className="text-[11px] text-zinc-500">Point of Sale System</p>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold text-zinc-100">
              {mode === 'login' ? 'Selamat Datang' : 'Buat Akun Baru'}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              {mode === 'login'
                ? 'Masuk ke outlet Anda'
                : 'Daftarkan outlet baru untuk memulai'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs text-zinc-300">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="anda@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs text-zinc-300">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-10 text-sm"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Masuk
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-outlet" className="text-xs text-zinc-300">Nama Outlet</Label>
                  <Input
                    id="reg-outlet"
                    type="text"
                    placeholder="Nama Toko Anda"
                    value={regOutletName}
                    onChange={(e) => setRegOutletName(e.target.value)}
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-owner" className="text-xs text-zinc-300">Nama Pemilik</Label>
                  <Input
                    id="reg-owner"
                    type="text"
                    placeholder="Nama lengkap pemilik"
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs text-zinc-300">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="pemilik@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs text-zinc-300">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>

                {/* Account Type - Default Free */}
                <div className="space-y-1.5">
                  <Label htmlFor="reg-account-type" className="text-xs text-zinc-300">Tipe Akun</Label>
                  <div className="relative">
                    <Input
                      id="reg-account-type"
                      type="text"
                      value="Free"
                      disabled
                      readOnly
                      className="bg-zinc-800/60 border-zinc-700 text-zinc-500 cursor-not-allowed pl-9 h-9 text-sm"
                    />
                    <Crown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Mulai gratis dengan fitur dasar POS
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-10 text-sm"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Daftar Sekarang
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                {mode === 'login'
                  ? 'Belum punya akun? Daftar'
                  : 'Sudah punya akun? Masuk'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
