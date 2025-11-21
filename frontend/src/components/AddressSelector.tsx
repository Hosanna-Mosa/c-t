import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Plus, Edit, Trash2 } from 'lucide-react';
import { addAddress, updateAddress, deleteAddress, getMe } from '@/lib/api';
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

interface AddressSelectorProps {
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string | null) => void;
  onAddressUpdate?: () => void; // Callback when address is added/updated/deleted
}

export function AddressSelector({ selectedAddressId, onAddressSelect, onAddressUpdate }: AddressSelectorProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState<Address>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const res = await getMe();
      const userAddresses = (res as any).data?.addresses || [];
      setAddresses(userAddresses);
      
      // Auto-select default address if none selected
      if (!selectedAddressId && userAddresses.length > 0) {
        const defaultAddr = userAddresses.find((addr: Address) => addr.isDefault);
        if (defaultAddr) {
          onAddressSelect(defaultAddr._id!);
        }
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure country is set (default to US if empty)
    const formData = {
      ...form,
      country: form.country || 'US',
    };
    
    setLoading(true);
    try {
      let res;
      if (editingAddress) {
        res = await updateAddress(editingAddress._id!, formData);
        toast.success('Address updated successfully');
      } else {
        res = await addAddress(formData);
        toast.success('Address added successfully');
      }
      
      const updatedAddresses = (res as any).data || res;
      setAddresses(updatedAddresses);
      
      // If this is the first address, auto-select it
      if (addresses.length === 0 && updatedAddresses.length > 0) {
        onAddressSelect(updatedAddresses[0]._id);
      }
      
      // Notify parent to refresh addresses and recalculate shipping
      // This is important when editing the currently selected address
      onAddressUpdate?.();
      
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address: Address) => {
    // Ensure country defaults to 'US' if empty (for old addresses)
    setForm({ 
      ...address, 
      country: address.country || 'US' 
    });
    setEditingAddress(address);
    setIsDialogOpen(true);
  };

  const handleDelete = async (addressId: string) => {
    if (confirm('Are you sure you want to delete this address?')) {
      try {
        const res = await deleteAddress(addressId);
        const updatedAddresses = (res as any).data || res;
        setAddresses(updatedAddresses);
        
        // If deleted address was selected, clear selection
        if (selectedAddressId === addressId) {
          onAddressSelect(null);
        }
        
        // Notify parent that addresses were updated
        onAddressUpdate?.();
        
        toast.success('Address deleted successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete address');
      }
    }
  };

  const resetForm = () => {
    setForm({
      fullName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US', // Default to US
    });
    setEditingAddress(null);
  };

  const selectedAddress = addresses.find(addr => addr._id === selectedAddressId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Shipping Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {addresses.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No addresses found</p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Address
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Address</DialogTitle>
                </DialogHeader>
                <AddressForm 
                  form={form} 
                  setForm={setForm} 
                  onSubmit={handleSubmit} 
                  loading={loading}
                  onCancel={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <>
            <RadioGroup value={selectedAddressId || ''} onValueChange={onAddressSelect}>
              {addresses.map((address) => (
                <div key={address._id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value={address._id!} id={address._id} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={address._id} className="cursor-pointer">
                      <div className="font-medium">{address.fullName} • {address.phone}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {address.line1}
                        {address.line2 && `, ${address.line2}`}
                        <br />
                        {address.city}, {address.state} {address.postalCode}
                        <br />
                        {address.country}
                      </div>
                      {address.isDefault && (
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                          Default
                        </span>
                      )}
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(address)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(address._id!)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </RadioGroup>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" onClick={() => resetForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Address
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                </DialogHeader>
                <AddressForm 
                  form={form} 
                  setForm={setForm} 
                  onSubmit={handleSubmit} 
                  loading={loading}
                  onCancel={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </>
        )}

        {selectedAddress && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              ✓ Selected: {selectedAddress.fullName}, {selectedAddress.city}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AddressFormProps {
  form: Address;
  setForm: (form: Address) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  onCancel: () => void;
}

// US State codes for UPS
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

// Common country codes for UPS
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'NZ', name: 'New Zealand' },
];

function AddressForm({ form, setForm, onSubmit, loading, onCancel }: AddressFormProps) {
  // Default to US if country is empty
  const countryCode = form.country || 'US';
  const showStateDropdown = countryCode === 'US';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            placeholder="John Doe"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            placeholder="+1 (555) 123-4567"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="line1">Street Address (Address Line 1) *</Label>
        <Input
          id="line1"
          placeholder="123 Main Street"
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="line2">Apartment, Suite, etc. (Optional)</Label>
        <Input
          id="line2"
          placeholder="Apt 4B, Suite 200"
          value={form.line2}
          onChange={(e) => setForm({ ...form, line2: e.target.value })}
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            placeholder="Los Angeles"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State/Province *</Label>
          {showStateDropdown ? (
            <Select
              value={form.state}
              onValueChange={(value) => setForm({ ...form, state: value })}
              required
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="state"
              placeholder="State or Province Code"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              required
              maxLength={2}
            />
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="postalCode">ZIP/Postal Code *</Label>
          <Input
            id="postalCode"
            placeholder="90001"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country Code *</Label>
          <Select
            value={countryCode}
            onValueChange={(value) => setForm({ ...form, country: value, state: '' })}
            required
          >
            <SelectTrigger id="country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.code} - {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Address'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
