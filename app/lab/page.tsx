import { Suspense } from "react";
import LabClient from "./LabClient";

export default function LabPage() {
  return (
    <Suspense>
      <LabClient />
    </Suspense>
  );
}
