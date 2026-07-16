import dynamic from "next/dynamic";

const FaceDetectionPage = dynamic(
  () => import("@/components/face-detection-page"),
  { ssr: false }
);

export default function Home() {
  return <FaceDetectionPage />;
}
