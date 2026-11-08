import { Suspense } from "react";
import TransposeClient from "./TransposeClient";

export default function TransposePage() {
  return (
    <Suspense>
      <TransposeClient />
    </Suspense>
  );
}
