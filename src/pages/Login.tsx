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
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logo} alt="Logo" className="h-16 w-auto object-contain mb-4" />
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-sm text-muted-foreground">Welcome, please sign in to your dashboard</p>
        </div>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="sr-only">Sign In</CardTitle>
            <CardDescription className="sr-only">Use your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="test@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => navigate('/forgot-password')}
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={staySignedIn}
                  onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Remember me
                </label>
              </div>
              <Button type="submit" className="w-full text-base py-6" disabled={loading}>
                {loading ? 'Loading...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}