import Image from "next/image";
import { cn } from "@/lib/utils";
import alpsCloudsPhoto from "../../../public/photos/alps-clouds.jpg";
import balloonsPhoto from "../../../public/photos/balloons.jpg";
import boatLakePhoto from "../../../public/photos/boat-lake.jpg";
import bridgePhoto from "../../../public/photos/bridge.jpg";
import crewPhoto from "../../../public/photos/crew.jpg";
import desertRoadPhoto from "../../../public/photos/desert-road.jpg";
import forestPeaksPhoto from "../../../public/photos/forest-peaks.jpg";
import heroPhoto from "../../../public/photos/hero.jpg";
import lakePhoto from "../../../public/photos/lake.jpg";
import oldTownPhoto from "../../../public/photos/old-town.jpg";
import pierPhoto from "../../../public/photos/pier.jpg";
import roadtripPhoto from "../../../public/photos/roadtrip.jpg";
import tentPhoto from "../../../public/photos/tent.jpg";
import valleyPhoto from "../../../public/photos/valley.jpg";

// Trips have no photo of their own yet, so each destination gets one of the site's travel photos,
// always the same one for the same city.
const PHOTOS = [
  lakePhoto, alpsCloudsPhoto, roadtripPhoto, bridgePhoto, boatLakePhoto, desertRoadPhoto, valleyPhoto, forestPeaksPhoto, pierPhoto, oldTownPhoto, balloonsPhoto, tentPhoto, crewPhoto, heroPhoto,
];

function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Fills its parent, which must be `relative` and sized. */
export function TripCover({ seed, className, sizes = "(max-width: 640px) 100vw, 400px" }: { seed: string; className?: string; sizes?: string }) {
  return (
    <Image
      src={PHOTOS[hash(seed) % PHOTOS.length]}
      alt={`Travel photo for ${seed}`}
      fill
      placeholder="blur"
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
}
