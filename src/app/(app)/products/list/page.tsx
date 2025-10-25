
import { db } from '@/lib/firebase';
import type { Product } from '@/lib/types';
import { collection, getDocs } from 'firebase/firestore';
import { ProductsClient } from '@/components/products/product-client';

async function getProducts(): Promise<Product[]> {
  const productsCol = collection(db, 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      stock: data.stock,
      category: data.category,
      cost: data.cost,
      units: data.units || [],
      baseUnit: data.baseUnit,
    } as Product;
  });
  return productList;
}

export default async function ProductsListPage() {
  const products = await getProducts();

  return <ProductsClient products={products} />;
}
