/** A React template styled with Tailwind; the root fills the canvas. */
export const ReactCard = ({
  title,
  label,
}: {
  title: string;
  label: string;
}) => (
  <div className="flex h-full w-full flex-col justify-between bg-slate-950 p-20 font-sans text-white">
    <p className="font-mono text-2xl tracking-widest text-sky-300 uppercase">
      {label}
    </p>
    <h1 className="text-[clamp(3rem,6vw,6rem)] leading-none font-semibold">
      {title}
    </h1>
    <p className="text-2xl text-slate-400">astro-takumi-images</p>
  </div>
);
