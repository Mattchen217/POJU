import type { WindCardParticleKey } from "./WindCardWithParticles";
import { WindCardWithParticles } from "./WindCardWithParticles";
import { WIND_CARDS_IN_ORDER } from "./wind-cards-art";

/**
 * 五风卡面：使用打包器读出的 PNG 原始宽高；五张均叠相同逻辑的粒子层，仅配色不同。
 */
export function WindCardsGallery() {
  return (
    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10 xl:grid-cols-5 xl:gap-6">
      {WIND_CARDS_IN_ORDER.map((item) => (
        <article key={item.key} className="flex min-w-0 justify-center">
          <WindCardWithParticles
            src={item.src}
            alt={item.alt}
            particleKey={item.key as WindCardParticleKey}
            className="shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 20vw"
            priority={item.key === "crosswind"}
          />
        </article>
      ))}
    </div>
  );
}
