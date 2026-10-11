import type { Metadata } from "next";
import MyStoksView from "@/components/MyStoksView";

export const metadata: Metadata = { title: "MyStoks · Bystok" };

// MyStoks: the connected wallet's tokenized-stock holdings, read-only.
export default function MyStoksPage() {
  return (
    <div className="mx-auto grid max-w-lg grid-cols-1 gap-4">
      <div>
        <h1 className="text-2xl font-bold">MyStoks</h1>
        <p className="text-sm text-muted">Your tokenized stocks on BNB Chain.</p>
      </div>
      <MyStoksView />
    </div>
  );
}
