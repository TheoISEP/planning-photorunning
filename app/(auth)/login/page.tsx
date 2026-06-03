'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue');
        setLoading(false);
        return;
      }

      // Redirection selon le rôle
      if (data.user.role === 'admin') {
        router.push('/admin/calendrier');
      } else {
        router.push('/photographer/calendrier');
      }
    } catch (err: any) {
      setError('Erreur de connexion au serveur');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-lg rounded-xl">
      <CardHeader className="space-y-3 text-center pt-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">PR</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">PhotoRunning Calendrier</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Connectez-vous à votre compte</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="rounded-lg"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? '🙈' : '👁️'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
