import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { sessionManager } from '@/lib/sessionManager';
import logo from '@/assets/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Store preference using session manager
      sessionManager.setStaySignedIn(staySignedIn);
      console.log('Stay signed in preference saved:', staySignedIn);

      toast({
        title: 'Welcome back!',
        description: staySignedIn 
          ? 'You have successfully signed in. You will stay signed in.' 
          : 'You have successfully signed in.',
      });
      navigate('/today');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary p-4">
      <Card className="w-full max-w-md elegant-card elegant-shadow-lg">
        <CardHeader className="space-y-1 text-center pb-4 sm:pb-6 p-4 sm:p-6">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Logo" className="h-16 w-auto object-contain" />
          </div>
          <CardTitle className="font-heading text-3xl font-bold gradient-text">MyDay</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="elegant-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="elegant-input"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stay-signed-in"
                checked={staySignedIn}
                onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
              />
              <label
                htmlFor="stay-signed-in"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Stay signed in
              </label>
            </div>
            <Button type="submit" className="w-full elegant-button text-lg py-6" disabled={loading}>
              {loading ? 'Loading...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <footer className="fixed bottom-4 text-center w-full text-sm text-muted-foreground">
        © MyDay Systems
      </footer>
    </div>
  );
}