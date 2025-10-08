import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/Layout';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto p-6">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/today')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="text-center py-12">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <MessageSquare className="h-16 w-16 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Messaging System Under Maintenance</CardTitle>
            <CardDescription className="text-base mt-4">
              We're upgrading the messaging system to provide you with a better experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              The messaging feature is temporarily unavailable while we migrate to an improved messaging infrastructure.
              This will enable better conversations, real-time notifications, and enhanced security.
            </p>
            <div className="bg-muted p-4 rounded-lg text-sm text-left max-w-md mx-auto">
              <p className="font-semibold mb-2">What's changing:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Organized conversation threads</li>
                <li>Improved message delivery</li>
                <li>Better read receipts</li>
                <li>Enhanced security</li>
              </ul>
            </div>
            <div className="mt-8">
              <Button onClick={() => navigate('/today')}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
