
"use client";

import React, { useState, useMemo, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Bot, Loader, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Product, Transaction } from "@/lib/types";
import { handleStockEstimation } from "@/app/(app)/stock-estimation/actions";
import type { EstimateStockQuantityOutput } from "@/ai/flows/estimate-stock-quantity";
import { useToast } from "@/hooks/use-toast";

interface EstimationFormProps {
  products: Product[];
  transactions: Transaction[];
}

const formSchema = z.object({
  productId: z.string().min(1, { message: "Silakan pilih produk." }),
  leadTimeDays: z.coerce.number().min(1, { message: "Lead time harus minimal 1 hari." }),
  storageCapacity: z.coerce.number().min(1, { message: "Kapasitas penyimpanan harus diisi." }),
});

export function EstimationForm({ products, transactions }: EstimationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<EstimateStockQuantityOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      leadTimeDays: 7,
      storageCapacity: 200,
    },
  });

  const selectedProductId = form.watch("productId");

  const { historicalSalesData, currentStockLevel } = useMemo(() => {
    if (!selectedProductId) {
      return { historicalSalesData: "[]", currentStockLevel: 0 };
    }
    const sales = transactions
      .flatMap(tx => tx.items.map(item => ({ ...item, date: tx.date })))
      .filter(item => item.productId === selectedProductId)
      .map(item => ({ date: item.date.toISOString().split('T')[0], quantity: item.quantity }));

    const stock = products.find(p => p.id === selectedProductId)?.stock || 0;

    return { historicalSalesData: JSON.stringify(sales), currentStockLevel: stock };
  }, [selectedProductId, transactions, products]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      setResult(null);
      const selectedProduct = products.find(p => p.id === values.productId);
      if (!selectedProduct) return;

      const input = {
        productName: selectedProduct.name,
        currentStockLevel,
        historicalSalesData,
        leadTimeDays: values.leadTimeDays,
        storageCapacity: values.storageCapacity,
      };

      const estimationResult = await handleStockEstimation(input);
      if (estimationResult.error) {
        toast({
          title: "Terjadi Kesalahan",
          description: estimationResult.error,
          variant: "destructive",
        });
      } else {
        setResult(estimationResult.data);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Parameter Estimasi</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produk</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih produk untuk diestimasi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Produk yang akan dianalisis oleh AI. Stok saat ini: <span className="font-bold">{currentStockLevel}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (Hari)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Contoh: 7" {...field} onFocus={(e) => e.target.select()} />
                    </FormControl>
                    <FormDescription>
                      Waktu yang dibutuhkan untuk restock produk setelah memesan.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storageCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kapasitas Penyimpanan</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Contoh: 200" {...field} onFocus={(e) => e.target.select()} />
                    </FormControl>
                    <FormDescription>
                      Jumlah maksimum produk yang bisa disimpan di gudang.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending || !selectedProductId} className="w-full">
                {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                Dapatkan Estimasi AI
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="sticky top-24">
        <Card className={result || isPending ? '' : 'flex items-center justify-center min-h-[400px] border-dashed'}>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <ThumbsUp />
              Saran AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending && (
              <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
                <Loader className="h-12 w-12 animate-spin text-primary" />
                <p className="font-semibold">AI sedang menganalisis data...</p>
                <p className="text-sm text-muted-foreground">Mohon tunggu sebentar.</p>
              </div>
            )}
            {!isPending && result && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estimasi Kuantitas Optimal</p>
                  <p className="text-4xl font-bold text-primary">{result.estimatedQuantity} <span className="text-lg font-normal text-foreground">unit</span></p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alasan</p>
                  <p className="text-md font-body whitespace-pre-wrap leading-relaxed">{result.reasoning}</p>
                </div>
              </div>
            )}
            {!isPending && !result && (
              <div className="text-center text-muted-foreground p-8">
                <p>Hasil estimasi akan muncul di sini setelah Anda mengisi form dan menekan tombol.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
