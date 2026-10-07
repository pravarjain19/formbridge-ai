import { OcrPreview } from "./ocr-preview";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">FormBridge.ai</h1>
      <p className="mt-2 text-slate-600">
        Upload a US Form 1042-S, 1099 or client payment advice. FormBridge reads it and checks whether US tax was
        withheld correctly before you claim credit for it in India.
      </p>
      <OcrPreview />
    </main>
  );
}
