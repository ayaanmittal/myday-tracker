import { AutoCheckoutManager } from '@/components/AutoCheckoutManager';
import { Layout } from '@/components/Layout';

export default function AutoCheckout() {
  return (
    <Layout>
      <div className="p-6">
        <AutoCheckoutManager />
      </div>
    </Layout>
  );
}
