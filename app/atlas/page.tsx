import { Suspense } from "react";
import AtlasClient from "./AtlasClient";

export default function AtlasPage() {
  return (
    <Suspense>
      <AtlasClient />
    </Suspense>
  );
}
