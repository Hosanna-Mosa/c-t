#!/bin/bash

# This script adds skeleton loaders to all admin pages

echo "Adding skeletons to admin pages..."

# Products.tsx - Add import
sed -i '' "1s/^/import { ProductCardSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/Products.tsx

# CasualProducts.tsx - Add import  
sed -i '' "1s/^/import { ProductCardSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/CasualProducts.tsx

# DTFProducts.tsx - Add import
sed -i '' "1s/^/import { ProductCardSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/DTFProducts.tsx

# Users.tsx - Add import
sed -i '' "1s/^/import { TableSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/Users.tsx

# Coupons.tsx - Add import
sed -i '' "1s/^/import { TableSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/Coupons.tsx

# Templates.tsx - Add import
sed -i '' "1s/^/import { ProductCardSkeleton, Skeleton } from '@\/components\/Skeleton'\n/" /Users/hosanna/BYV-WORKS/CUTSOM-TEE/cpy-2/c-t/admin/src/pages/Templates.tsx

echo "Skeleton imports added successfully!"
