import Scanner from "@/components/Scanner";

// Scan: the "Most traded" ticker, the stock list and the selected stock's report.
export default function Home() {
  return (
    <>
      <h1 className="sr-only">Scan tokenized stocks</h1>
      <Scanner />
    </>
  );
}
