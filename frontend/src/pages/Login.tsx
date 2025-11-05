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
import { useUserRole } from '@/hooks/useUserRole';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const navigate = useNavigate();
  const { data: role } = useUserRole();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Store preference using session manager and start refresh immediately if opted in
      sessionManager.setStaySignedIn(staySignedIn);
      if (staySignedIn) {
        sessionManager.startSessionRefresh();
      }
      console.log('Stay signed in preference saved:', staySignedIn);

      // Fetch user role to determine redirect
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData?.role === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/today');
        }
      } else {
        navigate('/today');
      }

      toast({
        title: 'Welcome back!',
        description: staySignedIn 
          ? 'You have successfully signed in. You will stay signed in.' 
          : 'You have successfully signed in.',
      });
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
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 overflow-hidden relative">
      {/* Decorative blur elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gray-700/30 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-red-500/15 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/logo.png" alt="ERCMAX Logo" className="h-24 sm:h-32 w-auto object-contain mb-3 sm:mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Login</h1>
          <p className="text-white/90 text-sm sm:text-base">Welcome, please sign in to your dashboard</p>
        </div>

        {/* Login Card */}
        <Card className="w-full border-0 shadow-2xl bg-gray-800/90 backdrop-blur-xl border-gray-700/50">
          <CardHeader className="pb-4">
            <CardTitle className="sr-only">Sign In</CardTitle>
            <CardDescription className="sr-only text-gray-300">Use your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="test@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-gray-600 focus:border-red-600 focus:ring-red-600/30 bg-gray-700/50 text-white placeholder:text-gray-400 backdrop-blur-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
                  <button
                    type="button"
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
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
                  className="border-gray-600 focus:border-red-600 focus:ring-red-600/30 bg-gray-700/50 text-white placeholder:text-gray-400 backdrop-blur-sm"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={staySignedIn}
                  onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
                  className="border-gray-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 data-[state=checked]:text-white"
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm leading-none text-white cursor-pointer"
                >
                  Remember me
                </label>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 mt-1 font-bold" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white">Loading...</span>
                  </div>
                ) : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}