import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { addAddress as apiAdd, updateAddress as apiUpdate, deleteAddress as apiDelete, getMe } from '@/lib/api';
import { toast } from 'sonner';

type Address = {
  _id?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
};

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>(user?.addresses || []);
  const [loading, setLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [form, setForm] = useState<Address>({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((res: any) => setAddresses(res.data?.addresses || [])).catch(() => { });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        const res = await apiUpdate(editingId, form);
        setAddresses((res as any).data || res);
        toast.success('Address updated');
      } else {
        const res = await apiAdd(form);
        setAddresses((res as any).data || res);
        toast.success('Address added');
      }
      setForm({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' });
      setEditingId(null);
      setShowAddressForm(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (addr: Address) => {
    setForm({ ...addr });
    setEditingId(addr._id!);
    setShowAddressForm(true);
  };

  const remove = async (id: string) => {
    try {
      const res = await apiDelete(id);
      setAddresses((res as any).data || res);
      toast.success('Address deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        {isAuthenticated && (
          <div className="mb-8">
            <div className="text-sm text-muted-foreground">Name</div>
            <div className="font-medium">{user?.name}</div>
            <div className="text-sm text-muted-foreground mt-4">Email</div>
            <div className="font-medium">{user?.email}</div>
          </div>
        )}

        <div>
          {!showAddressForm ? (
            <Button onClick={() => setShowAddressForm(true)} className="mb-4">
              Add Address
            </Button>
          ) : (
            <Card className="mb-4">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4">{editingId ? 'Edit Address' : 'Add Address'}</h2>
                <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                  <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                  <Input className="sm:col-span-2" placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
                  <Input className="sm:col-span-2" placeholder="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
                  <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                  <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
                  <Input placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} required />
                  <Input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
                  <div className="sm:col-span-2 flex gap-2 mt-2">
                    <Button type="submit" disabled={loading}>{loading ? 'Saving...' : (editingId ? 'Update' : 'Add')}</Button>
                    <Button variant="outline" type="button" onClick={() => { setEditingId(null); setForm({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' }); setShowAddressForm(false); }}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {addresses.length === 0 && <div className="text-sm text-muted-foreground">No addresses yet.</div>}
            {addresses.map((a) => (
              <Card key={a._id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{a.fullName} • {a.phone}</div>
                    <div className="text-sm text-muted-foreground">
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(a)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(a._id!)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div >
  );
}


