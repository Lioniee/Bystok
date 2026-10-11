import type { Metadata } from "next";
import MyStocksView from "@/components/MyStocksView";

export const metadata: Metadata = { title: "MyStocks · Bystok" };

// MyStocks: the connected wallet's tokenized-stock holdings, read-only.
export default function MyStocksPage() {
  return (
    <div className="mx-auto grid max-w-lg grid-cols-1 gap-4">
      <div>
        <h1 className="text-2xl font-bold">MyStocks</h1>
        <p className="text-sm text-muted">Your tokenized stocks on BNB Chain.</p>
      </div>
      <MyStocksView />
    </div>
  );
}
