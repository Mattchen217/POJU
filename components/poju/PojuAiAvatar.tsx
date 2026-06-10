import Image from "next/image";
import pojuAvatar from "@/assets/icons/P.png";

export function PojuAiAvatar() {
  return (
    <Image
      src={pojuAvatar}
      alt=""
      width={40}
      height={40}
      className="pchat__ai-avatar"
    />
  );
}
