import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl sm:text-4xl font-bold text-center">
              Terms of Service
            </CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          
          <CardContent className="prose prose-sm sm:prose max-w-none space-y-6">
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Custom Graphics4u, you accept and agree to be bound by the terms and 
                provision of this agreement. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">2. Use License</h2>
              <p className="text-muted-foreground mb-2">
                Permission is granted to temporarily download one copy of the materials on Custom Graphics4u 
                for personal, non-commercial transitory viewing only. This is the grant of a license, 
                not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained on Custom Graphics4u</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. Product Orders</h2>
              <p className="text-muted-foreground">
                All orders placed through our website are subject to product availability. We reserve 
                the right to refuse or cancel any order for any reason. Custom designs submitted by 
                customers must not infringe on any copyrights, trademarks, or intellectual property rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. Pricing and Payment</h2>
              <p className="text-muted-foreground">
                All prices are listed in USD and are subject to change without notice. Payment must be 
                received before order processing begins. We accept various payment methods including 
                credit cards and cash on delivery where available.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. Shipping and Delivery</h2>
              <p className="text-muted-foreground">
                We strive to deliver all orders within the estimated timeframe. However, delivery times 
                are estimates and not guaranteed. Custom Graphics4u is not responsible for delays caused by 
                shipping carriers or circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">6. Returns and Refunds</h2>
              <p className="text-muted-foreground">
                Due to the custom nature of our products, we do not accept returns unless the product 
                is defective or damaged upon arrival. Please contact our support team within 7 days of 
                receiving your order if you experience any issues.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">7. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content on this website, including but not limited to text, graphics, logos, and 
                software, is the property of Custom Graphics4u and is protected by copyright and trademark laws. 
                You may not use any content without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Custom Graphics4u shall not be liable for any indirect, incidental, special, consequential, or 
                punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3">9. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us at 
                Raj@customgraphics.com or call 510-929-0011.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
