import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing callback...');

  useEffect(() => {
    // Get callback parameters
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle error from OAuth provider
    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'Authentication failed. Please try again.');
      return;
    }

    // Handle successful callback
    if (code) {
      // Here you would typically send the code to your backend
      // to exchange it for an access token
      handleCallback(code, state);
    } else {
      setStatus('error');
      setMessage('Invalid callback parameters.');
    }
  }, [searchParams]);

  const handleCallback = async (code: string, state: string | null) => {
    try {
      // Send code to backend for token exchange
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ups/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus('success');
      setMessage('UPS integration successful! Redirecting...');
      
      // Redirect after success
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage('Failed to complete UPS integration. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {status === 'loading' && 'Processing...'}
              {status === 'success' && 'Success!'}
              {status === 'error' && 'Error'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center space-y-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            )}
            
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
            
            <p className="text-center text-muted-foreground">
              {message}
            </p>
            
            {status === 'error' && (
              <Button 
                onClick={() => navigate('/')}
                className="w-full"
              >
                Return to Home
              </Button>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
