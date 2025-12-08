import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
  className = '',
  style,
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
};

export const ProductCardSkeleton = () => {
  return (
    <div className="product-card-skeleton" style={{ border: '1px solid #eee', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Skeleton height="200px" borderRadius="8px" />
      <Skeleton width="80%" height="24px" />
      <Skeleton width="40%" height="20px" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <Skeleton width="30%" height="36px" borderRadius="20px" />
        <Skeleton width="30%" height="36px" borderRadius="20px" />
      </div>
    </div>
  );
};

export const DTFCardSkeleton = () => {
  return (
    <div className="dtf-card-skeleton" style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
      <Skeleton height="240px" width="100%" borderRadius="0" />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width="60%" height="24px" />
          <Skeleton width="20%" height="24px" borderRadius="12px" />
        </div>
        <Skeleton width="90%" height="16px" />
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Skeleton width="30%" height="14px" />
          <Skeleton width="30%" height="14px" />
        </div>
      </div>
    </div>
  );
};

export const HeroSkeleton = () => {
  return (
    <div style={{ width: '100%', height: '400px', position: 'relative', overflow: 'hidden', borderRadius: '12px', marginBottom: '40px' }}>
      <Skeleton width="100%" height="100%" borderRadius="12px" />
      <div style={{ position: 'absolute', bottom: '40px', left: '40px', width: '50%' }}>
        <Skeleton width="60%" height="48px" style={{ marginBottom: '16px' }} />
        <Skeleton width="80%" height="24px" style={{ marginBottom: '24px' }} />
        <Skeleton width="140px" height="48px" borderRadius="24px" />
      </div>
    </div>
  );
};

export const ProductDetailSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery Skeleton */}
        <div className="space-y-4">
          <Skeleton width="100%" height="500px" borderRadius="12px" />
          <div className="flex gap-4">
            <Skeleton width="80px" height="80px" borderRadius="8px" />
            <Skeleton width="80px" height="80px" borderRadius="8px" />
            <Skeleton width="80px" height="80px" borderRadius="8px" />
            <Skeleton width="80px" height="80px" borderRadius="8px" />
          </div>
        </div>

        {/* Product Info Skeleton */}
        <div className="space-y-6">
          <div>
            <Skeleton width="100px" height="24px" style={{ marginBottom: '8px' }} />
            <Skeleton width="80%" height="40px" style={{ marginBottom: '16px' }} />
            <Skeleton width="120px" height="32px" />
          </div>

          <div className="space-y-2">
            <Skeleton width="100%" height="16px" />
            <Skeleton width="100%" height="16px" />
            <Skeleton width="80%" height="16px" />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div>
              <Skeleton width="60px" height="20px" style={{ marginBottom: '8px' }} />
              <div className="flex gap-2">
                <Skeleton width="40px" height="40px" borderRadius="20px" />
                <Skeleton width="40px" height="40px" borderRadius="20px" />
                <Skeleton width="40px" height="40px" borderRadius="20px" />
              </div>
            </div>

            <div>
              <Skeleton width="60px" height="20px" style={{ marginBottom: '8px' }} />
              <div className="flex gap-2">
                <Skeleton width="60px" height="32px" borderRadius="4px" />
                <Skeleton width="60px" height="32px" borderRadius="4px" />
                <Skeleton width="60px" height="32px" borderRadius="4px" />
                <Skeleton width="60px" height="32px" borderRadius="4px" />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Skeleton width="100%" height="56px" borderRadius="8px" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CartSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <Skeleton width="200px" height="36px" style={{ marginBottom: '8px' }} />
          <Skeleton width="150px" height="20px" />
        </div>

        <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8">
          {/* Cart Items Skeleton */}
          <div className="flex-1 space-y-3 sm:space-y-4 mb-4 lg:mb-0">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="border rounded-xl p-4 md:p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6">
                  <Skeleton width="128px" height="128px" borderRadius="12px" className="shrink-0" />
                  <div className="flex flex-1 flex-col justify-between w-full">
                    <div className="space-y-2">
                      <Skeleton width="60%" height="24px" />
                      <Skeleton width="40%" height="16px" />
                      <Skeleton width="30%" height="16px" />
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <Skeleton width="100px" height="32px" borderRadius="8px" />
                      <Skeleton width="80px" height="24px" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary Skeleton */}
          <div className="lg:w-80 xl:w-96">
            <div className="border rounded-xl p-4 sm:p-6 space-y-4">
              <Skeleton width="150px" height="28px" style={{ marginBottom: '16px' }} />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton width="100px" height="16px" />
                  <Skeleton width="60px" height="16px" />
                </div>
                <div className="flex justify-between">
                  <Skeleton width="120px" height="16px" />
                  <Skeleton width="50px" height="16px" />
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <Skeleton width="60px" height="24px" />
                  <Skeleton width="100px" height="32px" />
                </div>
                <Skeleton width="100%" height="48px" borderRadius="8px" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OrdersSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <Skeleton width="120px" height="20px" style={{ marginBottom: '16px' }} />
            <Skeleton width="200px" height="36px" style={{ marginBottom: '8px' }} />
            <Skeleton width="150px" height="20px" />
          </div>

          <div className="space-y-4 sm:space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="border rounded-xl overflow-hidden">
                <div className="p-4 sm:p-6 bg-muted/30 flex justify-between items-center">
                  <div>
                    <Skeleton width="150px" height="24px" style={{ marginBottom: '8px' }} />
                    <Skeleton width="100px" height="16px" />
                  </div>
                  <Skeleton width="80px" height="24px" borderRadius="12px" />
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="flex gap-4">
                    <Skeleton width="80px" height="80px" borderRadius="8px" />
                    <div className="flex-1 space-y-2">
                      <Skeleton width="60%" height="20px" />
                      <Skeleton width="40%" height="16px" />
                      <Skeleton width="30%" height="16px" />
                    </div>
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center">
                    <Skeleton width="120px" height="20px" />
                    <Skeleton width="100px" height="28px" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TrackSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Skeleton width="200px" height="24px" style={{ marginBottom: '8px' }} />
            <Skeleton width="150px" height="16px" />
          </div>
          <div className="flex gap-2">
            <Skeleton width="100px" height="32px" borderRadius="16px" />
            <Skeleton width="80px" height="32px" borderRadius="4px" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton width="80%" height="20px" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Skeleton width="100px" height="16px" style={{ marginBottom: '4px' }} />
              <Skeleton width="120px" height="24px" />
            </div>
            <div>
              <Skeleton width="100px" height="16px" style={{ marginBottom: '4px' }} />
              <Skeleton width="120px" height="24px" />
              <Skeleton width="100px" height="16px" style={{ marginTop: '4px' }} />
            </div>
            <div>
              <Skeleton width="100px" height="16px" style={{ marginBottom: '4px' }} />
              <Skeleton width="120px" height="24px" />
            </div>
          </div>
          <div className="pt-4 border-t flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1">
                <Skeleton width="10px" height="10px" borderRadius="50%" />
                <Skeleton width="40px" height="16px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4 sm:p-6 space-y-4">
        <Skeleton width="150px" height="24px" />
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <Skeleton width="10px" height="10px" borderRadius="50%" />
                {i < 2 && <div className="w-px flex-1 bg-muted mt-1 h-12" />}
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton width="200px" height="20px" />
                <Skeleton width="150px" height="16px" />
                <Skeleton width="100px" height="16px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CheckoutSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="border rounded-xl p-6 space-y-4">
              <Skeleton width="150px" height="24px" style={{ marginBottom: '16px' }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton width="100%" height="120px" borderRadius="8px" />
                <Skeleton width="100%" height="120px" borderRadius="8px" />
              </div>
              <Skeleton width="100%" height="48px" borderRadius="8px" />
            </div>

            <div className="border rounded-xl p-6 space-y-4">
              <Skeleton width="150px" height="24px" style={{ marginBottom: '16px' }} />
              <div className="space-y-3">
                <Skeleton width="100%" height="60px" borderRadius="8px" />
                <Skeleton width="100%" height="60px" borderRadius="8px" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="border rounded-xl p-6 space-y-4 sticky top-4">
              <Skeleton width="150px" height="24px" style={{ marginBottom: '16px' }} />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton width="60px" height="60px" borderRadius="8px" />
                    <div className="flex-1 space-y-2">
                      <Skeleton width="80%" height="16px" />
                      <Skeleton width="40%" height="14px" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <Skeleton width="80px" height="16px" />
                  <Skeleton width="60px" height="16px" />
                </div>
                <div className="flex justify-between">
                  <Skeleton width="80px" height="16px" />
                  <Skeleton width="60px" height="16px" />
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <Skeleton width="100px" height="20px" />
                  <Skeleton width="80px" height="20px" />
                </div>
              </div>
              <Skeleton width="100%" height="48px" borderRadius="8px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Skeleton width="100px" height="100px" borderRadius="50%" />
            </div>
            <Skeleton width="200px" height="32px" className="mx-auto" />
            <Skeleton width="150px" height="20px" className="mx-auto" />
          </div>

          <div className="border rounded-xl p-6 space-y-6">
            <Skeleton width="150px" height="24px" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton width="80px" height="16px" />
                  <Skeleton width="100%" height="40px" borderRadius="8px" />
                </div>
                <div className="space-y-2">
                  <Skeleton width="80px" height="16px" />
                  <Skeleton width="100%" height="40px" borderRadius="8px" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton width="80px" height="16px" />
                <Skeleton width="100%" height="40px" borderRadius="8px" />
              </div>
              <Skeleton width="100%" height="48px" borderRadius="8px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TemplatesSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8 space-y-4">
          <Skeleton width="200px" height="36px" />
          <Skeleton width="300px" height="20px" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border rounded-xl overflow-hidden">
              <Skeleton width="100%" height="200px" borderRadius="0" />
              <div className="p-4 space-y-3">
                <Skeleton width="70%" height="20px" />
                <div className="flex justify-between items-center">
                  <Skeleton width="40%" height="16px" />
                  <Skeleton width="30%" height="24px" borderRadius="12px" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PaymentsSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <Skeleton width="200px" height="36px" />
            <Skeleton width="300px" height="20px" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-4 flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <Skeleton width="48px" height="48px" borderRadius="8px" />
                  <div className="space-y-2">
                    <Skeleton width="150px" height="20px" />
                    <Skeleton width="100px" height="16px" />
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <Skeleton width="80px" height="20px" />
                  <Skeleton width="60px" height="16px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CustomizeSkeleton = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b h-16 flex items-center px-4 justify-between">
        <Skeleton width="120px" height="32px" />
        <div className="flex gap-2">
          <Skeleton width="80px" height="32px" borderRadius="4px" />
          <Skeleton width="80px" height="32px" borderRadius="4px" />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-20 border-r flex flex-col items-center py-4 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="40px" height="40px" borderRadius="8px" />
          ))}
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-muted/20 p-8 flex items-center justify-center">
          <Skeleton width="500px" height="600px" borderRadius="12px" />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l p-4 space-y-6">
          <div className="space-y-4">
            <Skeleton width="100%" height="40px" borderRadius="8px" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} width="100%" height="40px" borderRadius="8px" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton width="100px" height="20px" />
            <Skeleton width="100%" height="100px" borderRadius="8px" />
          </div>
          <div className="pt-4 border-t">
            <Skeleton width="100%" height="48px" borderRadius="8px" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProductsPageSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-8 flex-1">
      <div className="mb-8 space-y-4 text-center">
        <Skeleton width="200px" height="40px" className="mx-auto" />
        <Skeleton width="300px" height="20px" className="mx-auto" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-xl overflow-hidden space-y-3 p-4">
            <Skeleton width="100%" height="250px" borderRadius="8px" />
            <Skeleton width="80%" height="24px" />
            <Skeleton width="40%" height="20px" />
            <div className="flex justify-between pt-2">
              <Skeleton width="60px" height="32px" borderRadius="16px" />
              <Skeleton width="60px" height="32px" borderRadius="16px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
